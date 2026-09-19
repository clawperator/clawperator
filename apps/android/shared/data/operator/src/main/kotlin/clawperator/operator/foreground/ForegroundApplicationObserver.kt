package clawperator.operator.foreground

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import androidx.annotation.MainThread
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch

sealed interface ForegroundApplicationState {
    data class Available(val packageName: String, val displayId: Int) : ForegroundApplicationState

    data object Unavailable : ForegroundApplicationState
}

/** Main-thread lifecycle owner. Collectors may subscribe from any coroutine dispatcher. */
class ForegroundApplicationObserver internal constructor(
    private val scope: CoroutineScope,
    private val read: suspend (AccessibilityService, Int) -> ForegroundApplicationState,
) {
    constructor(reader: ForegroundApplicationReader) : this(
        CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        { service, displayId -> reader.read(service, displayId) },
    )

    private class Subscriber(val displayId: Int, val emit: (ForegroundApplicationState) -> Unit)

    private val subscribers = mutableSetOf<Subscriber>()
    private var service: AccessibilityService? = null
    private var generation = 0L
    private var reconciliation: Job? = null

    internal val isObserving: Boolean
        @MainThread get() = subscribers.isNotEmpty()

    /** Emits explicit unavailable initially, then verified identity. No cached identity is replayed. */
    fun observe(displayId: Int = 0): Flow<ForegroundApplicationState> = callbackFlow {
        require(displayId >= 0)
        val subscriber = Subscriber(displayId) { trySend(it) }
        subscribers.add(subscriber)
        trySend(ForegroundApplicationState.Unavailable)
        reconcile()
        awaitClose {
            scope.launch {
                subscribers.remove(subscriber)
                if (subscribers.isEmpty()) invalidate()
            }
        }
    }.flowOn(scope.coroutineContext.minusKey(Job)).distinctUntilChanged()

    @MainThread
    fun attach(service: AccessibilityService) {
        invalidate()
        this.service = service
        subscribers.forEach { it.emit(ForegroundApplicationState.Unavailable) }
        reconcile()
    }

    @MainThread
    fun detach(service: AccessibilityService) {
        // A late destruction callback from an old service must not detach its replacement.
        if (this.service !== service) return
        invalidate()
        this.service = null
        subscribers.forEach { it.emit(ForegroundApplicationState.Unavailable) }
    }

    @MainThread
    fun onAccessibilityEvent(service: AccessibilityService, event: AccessibilityEvent?) {
        if (this.service !== service || event == null || subscribers.isEmpty()) return
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOWS_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_VIEW_FOCUSED,
            AccessibilityEvent.TYPE_VIEW_CLICKED,
            AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> reconcile()
        }
    }

    private fun invalidate() {
        generation += 1
        reconciliation?.cancel()
        reconciliation = null
    }

    private fun reconcile() {
        invalidate()
        val attached = service ?: return
        if (subscribers.isEmpty()) return
        val requestedGeneration = generation
        reconciliation = scope.launch {
            // Retry transient missing roots within a bounded window, never continuously poll.
            for (retryDelay in listOf(0L, 100L, 250L)) {
                if (retryDelay > 0) delay(retryDelay)
                var unavailable = false
                for (displayId in subscribers.map { it.displayId }.distinct()) {
                    val state = try {
                        read(attached, displayId)
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (_: Exception) {
                        ForegroundApplicationState.Unavailable
                    }
                    if (generation != requestedGeneration || service !== attached) return@launch
                    subscribers.filter { it.displayId == displayId }.forEach { it.emit(state) }
                    unavailable = unavailable || state == ForegroundApplicationState.Unavailable
                }
                if (!unavailable) break
            }
        }
    }
}
