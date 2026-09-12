package clawperator.operator.onscreenlog

import action.log.Log
import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.WindowInsets
import android.view.WindowManager
import android.view.accessibility.AccessibilityWindowInfo
import clawperator.task.runner.NormalizedOnScreenLogSpec
import clawperator.task.runner.OnScreenLogBounds
import clawperator.task.runner.OnScreenLogContract
import clawperator.task.runner.OnScreenLogController
import clawperator.task.runner.OnScreenLogControllerResult
import clawperator.task.runner.OnScreenLogGeometry
import clawperator.task.runner.OnScreenLogLayoutException
import clawperator.task.runner.OnScreenLogPanelGeometry
import clawperator.task.runner.OnScreenLogSpec
import clawperator.uitree.OperatorOverlayIdentity
import clawperator.uitree.OperatorOverlayWindowIdentity
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.util.UUID
import kotlin.coroutines.resume

/** Lifecycle callbacks owned by [clawperator.operator.accessibilityservice.OperatorAccessibilityService]. */
interface OnScreenLogPanelLifecycle {
    fun attach(service: AccessibilityService)

    fun detach()

    fun onConfigurationChanged()
}

/**
 * Service-owned accessibility-overlay renderer.
 *
 * All mutations run on the Android main thread. Expiry is generation-scoped and starts only once
 * the requested generation has drawn. The timer is cleanup only and never updates panel content.
 */
class OnScreenLogPanelController internal constructor(
    private val displayAreaProvider: OnScreenLogDisplayAreaProvider = AndroidOnScreenLogDisplayAreaProvider(),
    private val windowHostFactory: (WindowManager) -> OnScreenLogWindowHost = { windowManager ->
        AndroidOnScreenLogWindowHost(windowManager)
    },
    private val panelFactory: (Context) -> OnScreenLogPanelView = { context ->
        OnScreenLogPanelView(context)
    },
    private val mainHandler: Handler = Handler(Looper.getMainLooper()),
    private val scheduler: OnScreenLogScheduler = HandlerOnScreenLogScheduler(mainHandler),
    private val monotonicClock: OnScreenLogMonotonicClock = AndroidOnScreenLogMonotonicClock,
) : OnScreenLogController,
    OnScreenLogPanelLifecycle,
    OperatorOverlayIdentity {
    constructor() : this(
        displayAreaProvider = AndroidOnScreenLogDisplayAreaProvider(),
        windowHostFactory = { windowManager -> AndroidOnScreenLogWindowHost(windowManager) },
        panelFactory = { context -> OnScreenLogPanelView(context) },
        mainHandler = Handler(Looper.getMainLooper()),
        scheduler = HandlerOnScreenLogScheduler(Handler(Looper.getMainLooper())),
        monotonicClock = AndroidOnScreenLogMonotonicClock,
    )

    companion object {
        private const val TAG = "[OnScreenLogPanel]"
        private const val WINDOW_TITLE_PREFIX = "clawperator.on_screen_log"
        private const val ERROR_SERVICE_UNAVAILABLE = "ON_SCREEN_LOG_SERVICE_UNAVAILABLE"
        private const val ERROR_LAYOUT_INVALID = "ON_SCREEN_LOG_LAYOUT_INVALID"
        private const val ERROR_RENDER_FAILED = "ON_SCREEN_LOG_RENDER_FAILED"
        private const val ERROR_RENDER_TIMEOUT = "ON_SCREEN_LOG_RENDER_TIMEOUT"
    }

    private val operationMutex = Mutex()

    private var service: AccessibilityService? = null
    private var windowHost: OnScreenLogWindowHost? = null
    private var panelView: OnScreenLogPanelView? = null
    private var visibleState: VisiblePanelState? = null
    private var expiryRunnable: Runnable? = null
    private var pendingDrawAcknowledgement: PendingDrawAcknowledgement? = null
    private var generationCounter = 0L
    private val controllerWindowNonce = UUID.randomUUID().toString()

    @Volatile
    private var visibleWindowTitle: String? = null

    @Volatile
    private var ownedWindowId: Int? = null

    override val isOperatorOverlayVisible: Boolean
        get() = visibleWindowTitle != null

    override fun ownsOverlayWindow(window: OperatorOverlayWindowIdentity): Boolean {
        if (window.type != AccessibilityWindowInfo.TYPE_ACCESSIBILITY_OVERLAY) {
            return false
        }

        val expectedTitle = visibleWindowTitle ?: return false
        val knownWindowId = ownedWindowId
        if (knownWindowId != null) {
            return knownWindowId == window.id
        }

        if (window.title == expectedTitle) {
            ownedWindowId = window.id
            return true
        }
        return false
    }

    override fun attach(service: AccessibilityService) {
        runOnMain {
            if (this.service !== service) {
                removePanel(reason = "service_replaced")
                this.service = service
                val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
                windowHost = windowManager?.let(windowHostFactory)
                if (windowHost == null) {
                    Log.w("$TAG attach failed: WindowManager unavailable")
                }
            }
        }
    }

    override fun detach() {
        runOnMain {
            removePanel(reason = "service_detached")
            service = null
            windowHost = null
        }
    }

    override fun onConfigurationChanged() {
        runOnMain {
            val state = visibleState ?: return@runOnMain
            val currentService = service ?: return@runOnMain
            val host = windowHost ?: return@runOnMain
            val currentPanel = panelView ?: return@runOnMain

            try {
                val replacement = preparePanel(currentService, state.spec)
                val nextGeneration = nextGeneration()
                cancelExpiry()
                currentPanel.apply(replacement.prepared, nextGeneration)
                host.updateViewLayout(
                    currentPanel,
                    createLayoutParams(replacement.bounds, windowTitle(nextGeneration)),
                )
                val replacementState =
                    state.copy(
                        bounds = replacement.bounds,
                        truncated = replacement.prepared.truncated,
                        generation = nextGeneration,
                        windowTitle = windowTitle(nextGeneration),
                    )
                visibleState = replacementState
                visibleWindowTitle = replacementState.windowTitle
                ownedWindowId = null
                currentPanel.invalidate()
                scheduleExpiry(replacementState)
            } catch (error: OnScreenLogLayoutException) {
                Log.w("$TAG configuration_change hidden reason=${error.message}")
                removePanel(reason = "configuration_layout_invalid")
            } catch (error: Throwable) {
                Log.e(error, "$TAG configuration_change hidden after renderer failure")
                removePanel(reason = "configuration_render_failed")
            }
        }
    }

    override suspend fun set(
        spec: OnScreenLogSpec,
        drawAcknowledgementTimeoutMs: Long,
    ): OnScreenLogControllerResult =
        operationMutex.withLock {
            // Validate before touching expiry or an existing panel. Invalid replacement preserves state.
            val normalized = OnScreenLogContract.normalize(spec)
            if (drawAcknowledgementTimeoutMs <= 0L) {
                return@withLock OnScreenLogControllerResult.Failure(
                    errorCode = ERROR_RENDER_TIMEOUT,
                    message = "No execution time remains for draw acknowledgement",
                )
            }
            val acknowledgementDeadlineElapsedRealtimeMs =
                monotonicClock.elapsedRealtimeMs() +
                    drawAcknowledgementTimeoutMs.coerceAtMost(OnScreenLogContract.MAX_DRAW_ACKNOWLEDGEMENT_MS)

            try {
                withContext(Dispatchers.Main.immediate) {
                    val currentService = service
                        ?: return@withContext OnScreenLogControllerResult.Failure(
                            errorCode = ERROR_SERVICE_UNAVAILABLE,
                            message = "The Operator accessibility service is not connected",
                        )
                    val host = windowHost
                        ?: return@withContext OnScreenLogControllerResult.Failure(
                            errorCode = ERROR_SERVICE_UNAVAILABLE,
                            message = "The Operator accessibility window manager is unavailable",
                        )
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) {
                        return@withContext OnScreenLogControllerResult.Failure(
                            errorCode = ERROR_RENDER_FAILED,
                            message = "Accessibility overlay windows require Android API 22 or later",
                        )
                    }

                    val replacement =
                        try {
                            preparePanel(currentService, normalized)
                        } catch (error: OnScreenLogLayoutException) {
                            return@withContext OnScreenLogControllerResult.Failure(
                                errorCode = ERROR_LAYOUT_INVALID,
                                message = error.message ?: "Panel does not fit the usable display bounds",
                            )
                        }

                    val nextGeneration = nextGeneration()
                    cancelExpiry()
                    pendingDrawAcknowledgement?.complete(false)
                    pendingDrawAcknowledgement = null

                    val view = panelView ?: replacement.panel
                    val windowTitle = windowTitle(nextGeneration)
                    try {
                        view.apply(replacement.prepared, nextGeneration)
                        val layoutParams = createLayoutParams(replacement.bounds, windowTitle)
                        if (panelView == null) {
                            host.addView(view, layoutParams)
                            panelView = view
                        } else {
                            host.updateViewLayout(view, layoutParams)
                        }
                    } catch (error: Throwable) {
                        Log.e(error, "$TAG add_or_update failed generation=$nextGeneration")
                        removePanel(reason = "render_attach_failed")
                        return@withContext OnScreenLogControllerResult.Failure(
                            errorCode = ERROR_RENDER_FAILED,
                            message = "The panel window could not be attached or updated",
                        )
                    }

                    val remainingAcknowledgementMs =
                        acknowledgementDeadlineElapsedRealtimeMs - monotonicClock.elapsedRealtimeMs()
                    if (remainingAcknowledgementMs <= 0L) {
                        removePanel(reason = "render_deadline_elapsed")
                        return@withContext OnScreenLogControllerResult.Failure(
                            errorCode = ERROR_RENDER_TIMEOUT,
                            message = "The panel did not complete a draw before the acknowledgement deadline",
                        )
                    }

                    val acknowledged =
                        awaitDrawAcknowledgement(
                            view = view,
                            generation = nextGeneration,
                            timeoutMs = remainingAcknowledgementMs,
                        )
                    if (pendingDrawAcknowledgement?.generation == nextGeneration) {
                        pendingDrawAcknowledgement = null
                        view.onGenerationDrawn = null
                    }
                    if (!acknowledged) {
                        removePanel(reason = "render_not_acknowledged")
                        return@withContext OnScreenLogControllerResult.Failure(
                            errorCode = ERROR_RENDER_TIMEOUT,
                            message = "The panel did not complete a draw before the acknowledgement deadline",
                        )
                    }

                    val state =
                        VisiblePanelState(
                            spec = normalized,
                            bounds = replacement.bounds,
                            truncated = replacement.prepared.truncated,
                            generation = nextGeneration,
                            windowTitle = windowTitle,
                            expiryAtElapsedRealtimeMs = monotonicClock.elapsedRealtimeMs() + normalized.ttlMs,
                        )
                    visibleState = state
                    visibleWindowTitle = state.windowTitle
                    ownedWindowId = null
                    scheduleExpiry(state)
                    OnScreenLogControllerResult.Rendered(
                        spec = normalized,
                        bounds = replacement.bounds,
                        truncated = replacement.prepared.truncated,
                    )
                }
            } catch (cancelled: CancellationException) {
                withContext(NonCancellable + Dispatchers.Main.immediate) {
                    removePanel(reason = "render_cancelled")
                }
                throw cancelled
            } catch (error: Throwable) {
                Log.e(error, "$TAG render failed before acknowledgement")
                withContext(NonCancellable + Dispatchers.Main.immediate) {
                    removePanel(reason = "render_failed")
                }
                OnScreenLogControllerResult.Failure(
                    errorCode = ERROR_RENDER_FAILED,
                    message = "The panel renderer failed before acknowledgement",
                )
            }
        }

    override suspend fun clear(): OnScreenLogControllerResult =
        operationMutex.withLock {
            withContext(Dispatchers.Main.immediate) {
                removePanel(reason = "clear")
                OnScreenLogControllerResult.Cleared
            }
        }

    private fun preparePanel(
        service: AccessibilityService,
        spec: NormalizedOnScreenLogSpec,
    ): PreparedPanel {
        val usableBounds =
            displayAreaProvider.currentUsableBounds(service)
                ?: throw OnScreenLogLayoutException("The usable display bounds are unavailable")
        val density = service.resources.displayMetrics.density
        val scaledDensity = service.resources.displayMetrics.scaledDensity
        val panel = panelView ?: panelFactory(service)
        val completeTextLineHeightPx = panel.completeTextLineHeightPx(spec, scaledDensity)
        val geometry =
            OnScreenLogGeometry.resolve(
                spec = spec,
                density = density,
                scaledDensity = scaledDensity,
                usableBounds = usableBounds,
                completeTextLineHeightPx = completeTextLineHeightPx,
            )
        val prepared = panel.prepare(spec, geometry)
        val bounds =
            OnScreenLogBounds(
                left = geometry.bounds.left,
                top = geometry.bounds.top,
                right = geometry.bounds.right,
                bottom = geometry.bounds.top + prepared.heightPx,
            )
        return PreparedPanel(panel = panel, prepared = prepared, bounds = bounds)
    }

    private fun createLayoutParams(
        bounds: OnScreenLogBounds,
        title: String,
    ): WindowManager.LayoutParams =
        WindowManager.LayoutParams(
            bounds.width,
            bounds.height,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.LEFT
            x = bounds.left
            y = bounds.top
            this.title = title
        }

    private suspend fun awaitDrawAcknowledgement(
        view: OnScreenLogPanelView,
        generation: Long,
        timeoutMs: Long,
    ): Boolean =
        suspendCancellableCoroutine { continuation ->
            if (view.lastDrawnGeneration == generation) {
                continuation.resume(true)
                return@suspendCancellableCoroutine
            }

            val acknowledgement =
                PendingDrawAcknowledgement(
                    generation = generation,
                    completeCallback = { rendered ->
                        if (continuation.isActive) {
                            continuation.resume(rendered)
                        }
                    },
                    removeTimeout = scheduler::removeCallbacks,
                )
            val timeout =
                Runnable {
                    acknowledgement.complete(false)
                }
            acknowledgement.timeout = timeout
            pendingDrawAcknowledgement = acknowledgement
            view.onGenerationDrawn = { drawnGeneration ->
                if (drawnGeneration == acknowledgement.generation) {
                    acknowledgement.complete(true)
                }
            }
            scheduler.postDelayed(timeout, timeoutMs)
            continuation.invokeOnCancellation {
                acknowledgement.complete(false)
            }
        }

    private fun scheduleExpiry(state: VisiblePanelState) {
        cancelExpiry()
        val runnable =
            object : Runnable {
                override fun run() {
                    val current = visibleState
                    if (current == null || current.generation != state.generation) {
                        return
                    }
                    val remainingMs = current.expiryAtElapsedRealtimeMs - monotonicClock.elapsedRealtimeMs()
                    if (remainingMs > 0L) {
                        scheduler.postDelayed(this, remainingMs)
                        return
                    }
                    removePanel(reason = "expired_generation_${state.generation}")
                }
            }
        expiryRunnable = runnable
        val delayMs = (state.expiryAtElapsedRealtimeMs - monotonicClock.elapsedRealtimeMs()).coerceAtLeast(0L)
        scheduler.postDelayed(runnable, delayMs)
    }

    private fun cancelExpiry() {
        expiryRunnable?.let(scheduler::removeCallbacks)
        expiryRunnable = null
    }

    private fun removePanel(reason: String) {
        nextGeneration()
        cancelExpiry()
        pendingDrawAcknowledgement?.complete(false)
        pendingDrawAcknowledgement = null

        val view = panelView
        if (view != null) {
            view.onGenerationDrawn = null
            try {
                windowHost?.removeView(view)
            } catch (error: Throwable) {
                Log.w("$TAG remove failed reason=$reason error=${error.message}")
            }
        }
        panelView = null
        visibleState = null
        visibleWindowTitle = null
        ownedWindowId = null
    }

    private fun nextGeneration(): Long {
        generationCounter += 1L
        return generationCounter
    }

    private fun windowTitle(generation: Long): String =
        "$WINDOW_TITLE_PREFIX.$controllerWindowNonce.$generation"

    private fun runOnMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
        } else {
            mainHandler.post(block)
        }
    }

    private data class PreparedPanel(
        val panel: OnScreenLogPanelView,
        val prepared: OnScreenLogPanelView.Prepared,
        val bounds: OnScreenLogBounds,
    )

    private data class VisiblePanelState(
        val spec: NormalizedOnScreenLogSpec,
        val bounds: OnScreenLogBounds,
        val truncated: Boolean,
        val generation: Long,
        val windowTitle: String,
        val expiryAtElapsedRealtimeMs: Long,
    )

    private class PendingDrawAcknowledgement(
        val generation: Long,
        private val completeCallback: (Boolean) -> Unit,
        private val removeTimeout: (Runnable) -> Unit,
    ) {
        var timeout: Runnable? = null
        private val completed = java.util.concurrent.atomic.AtomicBoolean(false)

        fun complete(rendered: Boolean) {
            if (!completed.compareAndSet(false, true)) {
                return
            }
            timeout?.let(removeTimeout)
            completeCallback(rendered)
        }
    }
}

internal interface OnScreenLogMonotonicClock {
    fun elapsedRealtimeMs(): Long
}

internal object AndroidOnScreenLogMonotonicClock : OnScreenLogMonotonicClock {
    override fun elapsedRealtimeMs(): Long = SystemClock.elapsedRealtime()
}

internal interface OnScreenLogScheduler {
    fun postDelayed(
        runnable: Runnable,
        delayMs: Long,
    )

    fun removeCallbacks(runnable: Runnable)
}

private class HandlerOnScreenLogScheduler(
    private val handler: Handler,
) : OnScreenLogScheduler {
    override fun postDelayed(
        runnable: Runnable,
        delayMs: Long,
    ) {
        handler.postDelayed(runnable, delayMs)
    }

    override fun removeCallbacks(runnable: Runnable) {
        handler.removeCallbacks(runnable)
    }
}

internal interface OnScreenLogDisplayAreaProvider {
    fun currentUsableBounds(service: AccessibilityService): OnScreenLogBounds?
}

internal class AndroidOnScreenLogDisplayAreaProvider : OnScreenLogDisplayAreaProvider {
    override fun currentUsableBounds(service: AccessibilityService): OnScreenLogBounds? {
        val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return null
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val metrics = windowManager.currentWindowMetrics
                val bounds = metrics.bounds
                val insets =
                    metrics.windowInsets.getInsetsIgnoringVisibility(
                        WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout(),
                    )
                OnScreenLogBounds(
                    left = bounds.left + insets.left,
                    top = bounds.top + insets.top,
                    right = bounds.right - insets.right,
                    bottom = bounds.bottom - insets.bottom,
                )
            } else {
                legacyUsableBounds(service, windowManager)
            }
        } catch (error: Throwable) {
            Log.w("[OnScreenLogPanel] current usable bounds unavailable: ${error.message}")
            null
        }
    }

    @Suppress("DEPRECATION")
    private fun legacyUsableBounds(
        service: AccessibilityService,
        windowManager: WindowManager,
    ): OnScreenLogBounds {
        val metrics = android.util.DisplayMetrics()
        windowManager.defaultDisplay.getRealMetrics(metrics)
        val statusBarHeight = systemDimensionPx(service, "status_bar_height")
        val navigationBarHeight = systemDimensionPx(service, "navigation_bar_height")
        val navigationBarWidth = systemDimensionPx(service, "navigation_bar_width")
        val navigationOnSide =
            service.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE &&
                navigationBarWidth > 0
        return OnScreenLogBounds(
            left = 0,
            top = statusBarHeight,
            right = metrics.widthPixels - if (navigationOnSide) navigationBarWidth else 0,
            bottom = metrics.heightPixels - if (navigationOnSide) 0 else navigationBarHeight,
        )
    }

    private fun systemDimensionPx(
        service: AccessibilityService,
        name: String,
    ): Int {
        val resourceId = service.resources.getIdentifier(name, "dimen", "android")
        return if (resourceId > 0) service.resources.getDimensionPixelSize(resourceId) else 0
    }
}

internal interface OnScreenLogWindowHost {
    fun addView(
        view: OnScreenLogPanelView,
        layoutParams: WindowManager.LayoutParams,
    )

    fun updateViewLayout(
        view: OnScreenLogPanelView,
        layoutParams: WindowManager.LayoutParams,
    )

    fun removeView(view: OnScreenLogPanelView)
}

private class AndroidOnScreenLogWindowHost(
    private val windowManager: WindowManager,
) : OnScreenLogWindowHost {
    override fun addView(
        view: OnScreenLogPanelView,
        layoutParams: WindowManager.LayoutParams,
    ) {
        windowManager.addView(view, layoutParams)
    }

    override fun updateViewLayout(
        view: OnScreenLogPanelView,
        layoutParams: WindowManager.LayoutParams,
    ) {
        windowManager.updateViewLayout(view, layoutParams)
    }

    override fun removeView(view: OnScreenLogPanelView) {
        windowManager.removeViewImmediate(view)
    }
}
