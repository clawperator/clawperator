package clawperator.task.runner

import action.log.Log
import action.system.model.ApplicationId
import action.time.getCurrentTimeMillis
import clawperator.app.close.AppCloseManager
import clawperator.apps.AppsRepository
import clawperator.trigger.TriggerManager
import clawperator.uitree.UiNode
import clawperator.uitree.UiTreeFilterer
import clawperator.uitree.UiTreeFormatter
import clawperator.uitree.UiTreeInspector
import clawperator.uitree.UiTreeTraversal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlin.random.Random
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

class TaskScopeDefault(
    private val appsRepository: AppsRepository,
    private val triggerManager: TriggerManager,
    private val appCloseManager: AppCloseManager,
    private val uiTreeInspector: UiTreeInspector,
    private val uiTreeFilterer: UiTreeFilterer,
    private val uiTreeFormatter: UiTreeFormatter,
    private val taskUiScope: TaskUiScope,
    private val coroutineScopeIo: CoroutineScope,
) : TaskScope {
    companion object {
        private const val TAG = "[TaskScope]"
    }

    /**
     * Helper function to convert values to String for payload maps.
     * Drops null values to keep payloads clean.
     */
    private fun payload(vararg pairs: Pair<String, Any?>): Map<String, String> =
        pairs
            .mapNotNull { (key, value) ->
                value?.let { key to it.toString() }
            }.toMap()

    /**
     * Inline utility to measure timing around an operation and return both result and elapsed milliseconds.
     */
    private suspend inline fun <T> withStageTiming(
        crossinline block: suspend () -> T,
    ): Pair<T, Long> {
        val startTime = getCurrentTimeMillis()
        val result = block()
        val elapsedMs = getCurrentTimeMillis() - startTime
        return result to elapsedMs
    }

    private suspend inline fun <T> withRetry(
        retry: TaskRetry,
        stageId: String,
        stageLabel: String,
        crossinline successPayload: (T, Long, Int) -> Map<String, String> = { _, elapsedMs, attempt ->
            payload("elapsed_ms" to elapsedMs, "attempt" to attempt)
        },
        crossinline failurePayload: (Throwable, Int) -> Map<String, String> = { throwable, attempt ->
            payload("attempt" to attempt)
        },
        crossinline op: suspend () -> T,
    ): T {
        val sink = currentTaskStatus()
        sink.emit(TaskEvent.StageStart(stageId, stageLabel))

        var attempt = 1
        var delayNext = retry.initialDelay
        val maxDelay = retry.maxDelay.coerceAtLeast(retry.initialDelay)
        val stageStartTime = getCurrentTimeMillis()

        while (true) {
            try {
                val (result, operationElapsedMs) = withStageTiming { op() }
                val totalElapsedMs = getCurrentTimeMillis() - stageStartTime
                val payload = successPayload(result, totalElapsedMs, attempt)
                sink.emit(TaskEvent.StageSuccess(stageId, payload))
                return result
            } catch (t: Throwable) {
                if (t is kotlinx.coroutines.CancellationException) throw t
                if (attempt >= retry.maxAttempts) {
                    val failureData = failurePayload(t, attempt)
                    val reason =
                        if (failureData.containsKey("reason_code")) {
                            "${failureData["reason_code"]}: ${t.message ?: "failed"}"
                        } else {
                            t.message ?: "failed"
                        }
                    sink.emit(TaskEvent.StageFailure(stageId, reason, t))
                    // Emit failure context as a log event for easy grepping
                    if (failureData.isNotEmpty()) {
                        sink.emit(TaskEvent.Log("StageFailure context: ${failureData.entries.joinToString { "${it.key}=${it.value}" }}"))
                    }
                    throw t
                }

                val jitter = delayNext * retry.jitterRatio
                val min = (delayNext - jitter).coerceAtLeast(Duration.ZERO)
                val max = delayNext + jitter
                val sleep =
                    if (retry.jitterRatio > 0.0) {
                        val minMs = min.inWholeMilliseconds
                        val maxMs = max.inWholeMilliseconds
                        if (minMs < 0 || minMs > maxMs) {
                            // Fallback to delayNext if bounds are invalid
                            delayNext
                        } else {
                            Random.nextLong(minMs, maxMs + 1).milliseconds
                        }
                    } else {
                        delayNext
                    }

                sink.emit(TaskEvent.RetryScheduled(stageId, attempt, retry.maxAttempts, sleep.inWholeMilliseconds))
                Log.d("$TAG attempt $attempt failed: ${t.message}; retrying in ${sleep.inWholeMilliseconds}ms")
                delay(sleep)

                delayNext = (delayNext * retry.backoffMultiplier).coerceAtMost(maxDelay)
                attempt++
            }
        }
    }

    override suspend fun openApp(
        applicationId: ApplicationId,
        retry: TaskRetry,
    ) = withRetry(
        retry = retry,
        stageId = "openApp:$applicationId",
        stageLabel = "Opening $applicationId",
        successPayload = { _, elapsedMs, attempt ->
            payload(
                "stage_id" to "openApp:$applicationId",
                "application_id" to applicationId,
                "launch_method" to "shortcut", // Default to shortcut for now
                "cold_start" to "unknown", // Best-effort detection not implemented yet
                "elapsed_ms" to elapsedMs,
                "attempt" to attempt,
            )
        },
        failurePayload = { throwable, attempt ->
            // TODO: Replace string-based detection with typed exceptions (NodeNotFoundException, etc.)
            val reasonCode =
                when {
                    throwable.message?.contains("No app found") == true -> "app_not_found"
                    // Conservative: avoid brittle substring checks
                    else -> "unknown"
                }
            payload(
                "application_id" to applicationId,
                "reason_code" to reasonCode,
                "attempt" to attempt,
            )
        },
    ) {
        val triggerShortcut =
            appsRepository.findTriggerShortcut(applicationId).first()
                ?: throw IllegalStateException("No app found with applicationId=$applicationId")

        Log.d("$TAG Opening app: $applicationId")
        triggerManager.trigger(triggerShortcut.triggerEvent)
        Unit
    }

    override suspend fun pause(
        duration: Duration,
        retry: TaskRetry,
    ) = withRetry(
        retry = retry,
        stageId = "pause",
        stageLabel = "Pausing for ${duration.inWholeMilliseconds}ms",
        successPayload = { _, elapsedMs, attempt ->
            payload(
                "stage_id" to "pause",
                "requested_ms" to duration.inWholeMilliseconds,
                "elapsed_ms" to elapsedMs,
                "attempt" to attempt,
            )
        },
    ) {
        Log.d("$TAG Pausing for ${duration.inWholeMilliseconds}ms...")
        delay(duration)
        Log.d("$TAG Paused for ${duration.inWholeMilliseconds}ms")
        Unit
    }

    override suspend fun logUiTree(retry: TaskRetry) {
        val sink = currentTaskStatus()
        sink.emit(TaskEvent.StageStart("logUiTree", "Logging UI tree"))

        var attempt = 1
        var delayNext = retry.initialDelay
        val maxDelay = retry.maxDelay.coerceAtLeast(retry.initialDelay)
        val stageStartTime = getCurrentTimeMillis()

        while (true) {
            try {
                Log.d("$TAG Logging UI tree")
                val uiTreeRaw =
                    uiTreeInspector.getCurrentUiTree()
                        ?: throw IllegalStateException("UI tree not available")

                val uiTree = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)

                // Offload heavy computation to background
                val treeLog =
                    withContext(coroutineScopeIo.coroutineContext) {
                        val indexMap = UiTreeTraversal.buildIndexMap(uiTree.root)
                        uiTreeFormatter.toAsciiTree(
                            uiTree,
                            showTreeIndex = true,
                            showId = false,
                            indexMap = indexMap,
                        )
                    }
                Log.d("$TAG UI Tree:\n$treeLog")

                // Compute tree stats and include in payload
                val nodeCount = countNodes(uiTree.root)
                val maxDepth = calculateMaxDepth(uiTree.root)
                val totalElapsedMs = getCurrentTimeMillis() - stageStartTime

                val successPayload =
                    payload(
                        "stage_id" to "logUiTree",
                        "node_count" to nodeCount,
                        "max_depth" to maxDepth,
                        "truncated" to "false", // TODO: Implement truncation detection
                        "elapsed_ms" to totalElapsedMs,
                        "attempt" to attempt,
                    )
                sink.emit(TaskEvent.StageSuccess("logUiTree", successPayload))
                return
            } catch (t: Throwable) {
                if (t is kotlinx.coroutines.CancellationException) throw t
                if (attempt >= retry.maxAttempts) {
                    sink.emit(TaskEvent.StageFailure("logUiTree", t.message ?: "failed", t))
                    throw t
                }

                val jitter = delayNext * retry.jitterRatio
                val min = (delayNext - jitter).coerceAtLeast(Duration.ZERO)
                val max = delayNext + jitter
                val sleep =
                    if (retry.jitterRatio > 0.0) {
                        val minMs = min.inWholeMilliseconds
                        val maxMs = max.inWholeMilliseconds
                        if (minMs < 0 || minMs > maxMs) {
                            delayNext
                        } else {
                            Random.nextLong(minMs, maxMs + 1).milliseconds
                        }
                    } else {
                        delayNext
                    }

                sink.emit(TaskEvent.RetryScheduled("logUiTree", attempt, retry.maxAttempts, sleep.inWholeMilliseconds))
                Log.d("$TAG attempt $attempt failed: ${t.message}; retrying in ${sleep.inWholeMilliseconds}ms")
                delay(sleep)

                delayNext = (delayNext * retry.backoffMultiplier).coerceAtMost(maxDelay)
                attempt++
            }
        }
    }

    /**
     * Helper function to count total nodes in a UI tree recursively.
     */
    private fun countNodes(node: UiNode): Int = 1 + node.children.sumOf { countNodes(it) }

    /**
     * Helper function to calculate maximum depth of UI tree recursively.
     */
    private fun calculateMaxDepth(
        node: UiNode,
        currentDepth: Int = 0,
    ): Int =
        if (node.children.isEmpty()) {
            currentDepth
        } else {
            node.children.maxOf { calculateMaxDepth(it, currentDepth + 1) }
        }

    override suspend fun <T> ui(block: suspend TaskUiScope.() -> T): T {
        Log.d("$TAG Executing UI operations")
        val result = taskUiScope.block()
        Log.d("$TAG UI operations completed, result: $result")
        return result
    }

    /**
     * Closes (backgrounds) the specified app by simulating a swipe gesture in Recents.
     *
     * This function implements a reliable app closing strategy:
     * 1. First ensures the target app is in the foreground by opening it
     * 2. Delegates to AppCloseManager to perform the actual closing gesture
     *
     * **Why open the app first?**
     * Opening the app first ensures it appears as the most recent app in Recents,
     * making it the first (topmost) app card that gets swiped away.
     *
     * **Retry Behavior:**
     * Uses the provided retry configuration, with TaskRetryPresets.AppClose
     * providing sensible defaults for app closing operations.
     *
     * @param applicationId The package name of the app to close
     * @param retry Retry configuration for handling failures
     * @throws Exception if the app cannot be closed after all retry attempts
     */
    override suspend fun closeApp(
        applicationId: ApplicationId,
        retry: TaskRetry,
    ) = withRetry(
        retry = retry,
        stageId = "closeApp:$applicationId",
        stageLabel = "Closing $applicationId",
        successPayload = { _, elapsedMs, attempt ->
            payload(
                "stage_id" to "closeApp:$applicationId",
                "application_id" to applicationId,
                "strategy" to "recents_swipe", // Default strategy used
                "elapsed_ms" to elapsedMs,
                "attempt" to attempt,
            )
        },
        failurePayload = { throwable, attempt ->
            // TODO: Replace string-based detection with typed exceptions
            val reasonCode =
                when {
                    // Conservative: only check specific known error messages
                    throwable.message?.contains("not in recents") == true -> "not_in_recents"
                    else -> "unknown"
                }
            payload(
                "application_id" to applicationId,
                "reason_code" to reasonCode,
                "attempt" to attempt,
            )
        },
    ) {
        Log.d("$TAG ⚡ Starting closeApp for: $applicationId")

        // Step 1: Ensure target app is in foreground (makes it first in Recents)
        Log.d("$TAG 🚀 Step 1: Opening app to bring to foreground")
        openApp(applicationId, retry = TaskRetryPresets.AppLaunch)
        pause(1.seconds)
        Log.d("$TAG ✅ App opened and should be in foreground")

        // Step 2: Perform the closing gesture via AppCloseManager
        appCloseManager.closeFirstAppInRecents(applicationId)

        // Add a pause to ensure the app is closed
        pause(1.seconds)
    }
}
