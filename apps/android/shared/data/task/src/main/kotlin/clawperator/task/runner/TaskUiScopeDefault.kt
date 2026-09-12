package clawperator.task.runner

// Helper function to get current task status from coroutine context
import action.log.Log
import action.time.getCurrentTimeMillis
import action.math.geometry.Point
import clawperator.uitree.ToggleState
import clawperator.uitree.UiNode
import clawperator.uitree.UiRole
import clawperator.uitree.UiTree
import clawperator.uitree.UiTreeClickTypes
import clawperator.uitree.UiTreeFilterer
import clawperator.uitree.UiTreeFormatter
import clawperator.uitree.UiTreeInspector
import clawperator.uitree.UiTreeManager
import clawperator.uitree.UiTreeTraversal
import clawperator.uitree.inferOnOffState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlin.random.Random
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

class TaskUiScopeDefault(
    private val uiTreeInspector: UiTreeInspector,
    private val uiTreeFilterer: UiTreeFilterer,
    private val uiTreeFormatter: UiTreeFormatter,
    private val uiTreeManager: UiTreeManager,
    private val coroutineScopeIo: CoroutineScope,
) : TaskUiScope {
    override suspend fun queryUi(
        matcher: NodeMatcher?,
        visibility: String,
        limit: Int,
    ): String {
        val raw = uiTreeInspector.getCurrentUiTree()
            ?: throw QueryHierarchyUnavailableException(uiTreeInspector.getUnavailableHierarchyDiagnostics())
        val capturedAt = queryCaptureTimestamp()
        val visible = uiTreeFilterer.filterOnScreenOnly(raw)
        return NodeResolver(visible).query(matcher, visibility, limit, capturedAt = capturedAt)
    }

    companion object {
        private const val TAG = "[TaskUiScope]"
        private const val DEBUG_SCROLL_LOGGING = false // Set to true for detailed scroll debugging
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
     * Creates a stable hash for UI text content to avoid PII leakage.
     */
    private fun hashNodeText(text: String): String {
        // Simple hash for now - could use SHA-1 for better stability across platforms
        return text.hashCode().toString(16).take(8)
    }

    private suspend inline fun <T> withRetry(
        retry: TaskRetry,
        operation: String,
        crossinline successPayload: (T, Long, Int) -> Map<String, String> = { _, elapsedMs, attempt ->
            payload("elapsed_ms" to elapsedMs, "attempt" to attempt)
        },
        crossinline failurePayload: (Throwable, Int) -> Map<String, String> = { _, attempt ->
            payload("attempt" to attempt)
        },
        crossinline op: suspend () -> T,
    ): T {
        val sink = currentTaskStatus()
        sink.emit(TaskEvent.StageStart(operation, operation))

        var attempt = 1
        var delayNext = retry.initialDelay
        val maxDelay = retry.maxDelay.coerceAtLeast(retry.initialDelay)
        val stageStartTime = getCurrentTimeMillis()

        while (true) {
            try {
                val result = op()
                val totalElapsedMs = getCurrentTimeMillis() - stageStartTime
                val payload = successPayload(result, totalElapsedMs, attempt)
                sink.emit(TaskEvent.StageSuccess(operation, payload))
                return result
            } catch (t: Throwable) {
                if (t is kotlinx.coroutines.CancellationException) throw t
                if (t is StrictSelectionException && t.code != "NODE_NOT_FOUND") throw t
                if (attempt >= retry.maxAttempts) {
                    Log.e(TAG, "$operation failed after $attempt attempts: ${t.message}")
                    val failureData = failurePayload(t, attempt)
                    val reason =
                        if (failureData.containsKey("reason_code")) {
                            "${failureData["reason_code"]}: ${t.message ?: "failed"}"
                        } else {
                            t.message ?: "failed"
                        }
                    sink.emit(TaskEvent.StageFailure(operation, reason, t))
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

                sink.emit(TaskEvent.RetryScheduled(operation, attempt, retry.maxAttempts, sleep.inWholeMilliseconds))
                Log.d("$TAG $operation attempt $attempt failed: ${t.message}; retrying in ${sleep.inWholeMilliseconds}ms")
                delay(sleep)

                delayNext = (delayNext * retry.backoffMultiplier).coerceAtMost(maxDelay)
                attempt++
            }
        }
    }

    /**
     * Gets the text content of a UI element that matches the specified NodeMatcher criteria and validates it.
     * Retries according to the retry configuration until a matching element is found, text extracted,
     * and the validator function returns true.
     *
     * @param matcher NodeMatcher containing the criteria to match
     * @param retry Retry configuration (defaults to UiReadiness)
     * @param validator Lambda function that validates the text content
     * @return The validated text content of the matching element
     * @throws Exception if no matching element is found, text cannot be extracted, or validation fails after all retries
     */
    override suspend fun getValidatedText(
        matcher: NodeMatcher,
        retry: TaskRetry,
        strict: Boolean,
        validator: (String) -> Boolean,
    ): String =
        withRetry(
            retry = retry,
            operation = "getValidatedText($matcher)",
            successPayload = { text, elapsedMs, attempt ->
                payload(
                    "matcher" to matcher.toString(),
                    "validator" to "custom", // Could be improved with validator identification
                    "validated_value" to hashNodeText(text), // Redacted hash
                    "elapsed_ms" to elapsedMs,
                    "attempt" to attempt,
                )
            },
            failurePayload = { throwable, attempt ->
                val failurePoint =
                    when {
                        throwable.message?.contains("not found") == true -> "node_not_found"
                        throwable.message?.contains("no text content") == true -> "text_missing"
                        throwable.message?.contains("Validation failed") == true -> "validation_failed"
                        else -> "unknown"
                    }
                payload(
                    "matcher" to matcher.toString(),
                    "validator" to "custom",
                    "failure_point" to failurePoint,
                    "attempt" to attempt,
                )
            },
        ) {
            Log.d("$TAG Getting validated text for node matching: $matcher")

            val uiTreeRaw =
                uiTreeInspector.getCurrentUiTree()
                    ?: throw IllegalStateException("UI tree not available")

            val uiTree = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)

            val uiNode =
                actionNodes(matcher, uiTree, strict, null).firstOrNull()
                    ?: throw IllegalStateException("No UI node found matching criteria: $matcher")

            val text = uiNode.label
            if (text.isBlank()) {
                throw IllegalStateException("Matching UI node has no text content")
            }

            // Validate the text
            if (!validator(text)) {
                Log.d("$TAG Validation failed for text '$text' from matching node")
                throw IllegalStateException("Validation failed for text '$text' from matching UI node")
            }

            Log.d("$TAG ✅ Validated text: '$text'")
            text
        }

    private suspend fun findNodeByMatcher(
        matcher: NodeMatcher,
        uiTree: UiTree,
    ): UiNode? = findAllNodesByMatcher(matcher, uiTree).firstOrNull()

    private suspend fun findAllNodesByMatcher(
        matcher: NodeMatcher,
        uiTree: UiTree,
    ): List<UiNode> =
        withContext(coroutineScopeIo.coroutineContext) {
            NodeResolver(uiTree).resolve(matcher).map { it.node }
        }

    private fun selectCandidates(
        resolver: NodeResolver,
        candidates: List<NodeResolver.Candidate>,
        strict: Boolean,
        container: Boolean = false,
        allowEmpty: Boolean = false,
        allowMany: Boolean = false,
    ): List<NodeResolver.Candidate> {
        if (strict && ((!allowMany && candidates.size > 1) || (!allowEmpty && candidates.isEmpty()))) {
            val prefix = if (container) "CONTAINER" else "NODE"
            val suffix = if (candidates.isEmpty()) "NOT_FOUND" else "AMBIGUOUS"
            throw StrictSelectionException("${prefix}_$suffix", candidates.size, resolver.encodeMatches(candidates))
        }
        return candidates
    }

    private fun actionNodes(
        matcher: NodeMatcher,
        tree: UiTree,
        strict: Boolean,
        container: NodeMatcher? = null,
        allowEmpty: Boolean = false,
        allowMany: Boolean = false,
    ): List<UiNode> {
        val resolver = NodeResolver(tree)
        val scope = container?.let {
            selectCandidates(resolver, resolver.resolve(it), strict, container = true).firstOrNull()
                ?: throw IllegalStateException("Container not found for $it")
        }
        val matches = resolver.resolve(matcher).filter { scope == null || it.nodePath.startsWith("${scope.nodePath}.") }
        return selectCandidates(resolver, matches, strict, allowEmpty = allowEmpty, allowMany = allowMany).map { it.node }
    }

    private fun scrollNode(
        tree: UiTree,
        container: NodeMatcher?,
        strict: Boolean,
        findChild: Boolean,
        allowMissing: Boolean = false,
    ): UiNode? {
        val resolver = NodeResolver(tree)
        val scope = container?.let {
            selectCandidates(resolver, resolver.resolve(it), strict, container = true).firstOrNull()
                ?: if (allowMissing && !strict) return null else throw IllegalStateException("Container not found for $it")
        }
        if (scope != null && isScrollable(scope.node)) return scope.node
        if (scope != null && !findChild) throw IllegalStateException("Scrollable container not found for $container")
        val scrollables = resolver.resolve(null).filter {
            isScrollable(it.node) && (scope == null || it.nodePath.startsWith("${scope.nodePath}."))
        }
        if (!strict && scope != null && scrollables.isEmpty() && !allowMissing) {
            throw IllegalStateException("Scrollable container not found for $container")
        }
        return selectCandidates(resolver, scrollables, strict, container = true).firstOrNull()?.node
    }

    private fun scrollTarget(
        target: NodeMatcher,
        tree: UiTree,
        container: NodeMatcher?,
        strict: Boolean,
        findChild: Boolean,
    ): UiNode? {
        if (!strict && container == null) return NodeResolver(tree).resolve(target).firstOrNull()?.node
        // Resolve the same eligible scroll scope on every observation, including target-only checks.
        val selected = scrollNode(tree, container, strict, findChild) ?: return null
        val resolver = NodeResolver(tree)
        val scope = resolver.resolve(null).first { it.node === selected }
        val matches = resolver.resolve(target).filter { it.nodePath.startsWith("${scope.nodePath}.") }
        return selectCandidates(resolver, matches, strict, allowEmpty = true).firstOrNull()?.node
    }

    override suspend fun waitForNode(
        matcher: NodeMatcher,
        retry: TaskRetry,
        timeoutMs: Long?,
        strict: Boolean,
        container: NodeMatcher?,
    ): TaskUiNode {
        var lastSelectionFailure: StrictSelectionException? = null
        val operation: suspend () -> TaskUiNode = {
            withRetry(retry, "waitForNode($matcher)") {
                Log.d("$TAG Waiting for node matching: $matcher")

                val uiTreeRaw =
                    uiTreeInspector.getCurrentUiTree()
                        ?: throw IllegalStateException("UI tree not available")

                val uiTree = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)

                val uiNode =
                    try {
                        actionNodes(matcher, uiTree, strict, container).firstOrNull()
                    } catch (error: StrictSelectionException) {
                        lastSelectionFailure = error
                        throw error
                    }
                        ?: throw IllegalStateException("No UI node found matching criteria: $matcher")

                val taskUiNode =
                    TaskUiNode(
                        resourceId = uiNode.resourceId,
                        label = uiNode.label,
                        contentDescription = uiNode.contentDescription,
                        clickable = uiNode.isClickable,
                        role = uiNode.role.name.lowercase(),
                        bounds = uiNode.bounds,
                        debugPath = uiNode.id.value,
                    )
                Log.d("$TAG Found matching node: $taskUiNode")
                taskUiNode
            }
        }

        return if (timeoutMs != null) {
            try {
                kotlinx.coroutines.withTimeout(timeoutMs) { operation() }
            } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
                lastSelectionFailure?.let { throw it }
                throw IllegalStateException("Timeout waiting for node matching: $matcher (timeoutMs=$timeoutMs)")
            }
        } else {
            operation()
        }
    }

    override suspend fun readKeyValuePair(
        labelMatcher: NodeMatcher,
        retry: TaskRetry,
    ): Pair<String, String> =
        withRetry(retry, "readKeyValuePair($labelMatcher)") {
            Log.d("$TAG readKeyValuePair: $labelMatcher")

            val uiTreeRaw =
                uiTreeInspector.getCurrentUiTree()
                    ?: throw IllegalStateException("UI tree not available")

            val uiTreeFiltered = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)
            resolveKeyValuePair(uiTreeFiltered, labelMatcher)
        }

    override suspend fun getText(
        matcher: NodeMatcher,
        retry: TaskRetry,
        strict: Boolean,
    ): String =
        withRetry(retry, "getText($matcher)") {
            Log.d("$TAG Getting text for node matching: $matcher")

            val uiTreeRaw =
                uiTreeInspector.getCurrentUiTree()
                    ?: throw IllegalStateException("UI tree not available")

            val uiTree = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)

            val uiNode =
                actionNodes(matcher, uiTree, strict, null).firstOrNull()
                    ?: throw IllegalStateException("No UI node found matching criteria: $matcher")

            val text = uiNode.label
            if (text.isBlank()) {
                throw IllegalStateException("Matching UI node has no text content")
            }

            Log.d("$TAG Got text from matching node: '$text'")
            text
        }

    override suspend fun getAllText(
        matcher: NodeMatcher,
        retry: TaskRetry,
        strict: Boolean,
    ): List<String> =
        withRetry(retry, "getAllText($matcher)") {
            Log.d("$TAG Getting all text for nodes matching: $matcher")

            val uiTreeRaw =
                uiTreeInspector.getCurrentUiTree()
                    ?: throw IllegalStateException("UI tree not available")

            val uiTree = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)

            val uiNodes = actionNodes(matcher, uiTree, strict, allowEmpty = true, allowMany = true)

            val texts = uiNodes.map { it.label }.filter { it.isNotBlank() }

            Log.d("$TAG Got text from ${texts.size} matching nodes")
            texts
        }

    override suspend fun getTextWithinContainer(
        matcher: NodeMatcher,
        containerMatcher: NodeMatcher,
        retry: TaskRetry,
        strict: Boolean,
    ): String =
        withRetry(retry, "getTextWithinContainer(matcher=$matcher, container=$containerMatcher)") {
            Log.d("$TAG Getting text for node matching: $matcher within container: $containerMatcher")

            val uiTreeRaw =
                uiTreeInspector.getCurrentUiTree()
                    ?: throw IllegalStateException("UI tree not available")

            val uiTree = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)

            val uiNode = actionNodes(matcher, uiTree, strict, containerMatcher).firstOrNull()
                ?: throw IllegalStateException("No UI node found matching criteria: $matcher")

            val text = uiNode.label
            if (text.isBlank()) {
                throw IllegalStateException("Matching UI node has no text content")
            }

            Log.d("$TAG Got text from matching node within container: '$text'")
            text
        }

    override suspend fun getValidatedTextWithinContainer(
        matcher: NodeMatcher,
        containerMatcher: NodeMatcher,
        retry: TaskRetry,
        strict: Boolean,
        validator: (String) -> Boolean,
    ): String =
        withRetry(retry, "getValidatedTextWithinContainer(matcher=$matcher, container=$containerMatcher)") {
            Log.d("$TAG Getting validated text for node matching: $matcher within container: $containerMatcher")

            val uiTreeRaw =
                uiTreeInspector.getCurrentUiTree()
                    ?: throw IllegalStateException("UI tree not available")

            val uiTree = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)

            val uiNode = actionNodes(matcher, uiTree, strict, containerMatcher).firstOrNull()
                ?: throw IllegalStateException("No UI node found matching criteria: $matcher")

            val text = uiNode.label
            if (text.isBlank()) {
                throw IllegalStateException("Matching UI node has no text content")
            }

            // Validate the text
            if (!validator(text)) {
                Log.d("$TAG Validation failed for text '$text' from matching node within container")
                throw IllegalStateException("Validation failed for text '$text' from matching UI node within container")
            }

            Log.d("$TAG Got validated text from matching node within container: '$text'")
            text
        }

    override suspend fun getAllTextWithinContainer(
        matcher: NodeMatcher,
        containerMatcher: NodeMatcher,
        retry: TaskRetry,
        strict: Boolean,
    ): List<String> =
        withRetry(retry, "getAllTextWithinContainer(matcher=$matcher, container=$containerMatcher)") {
            Log.d("$TAG Getting all text for nodes matching: $matcher within container: $containerMatcher")

            val uiTreeRaw =
                uiTreeInspector.getCurrentUiTree()
                    ?: throw IllegalStateException("UI tree not available")

            val uiTree = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)

            val uiNodes = actionNodes(matcher, uiTree, strict, containerMatcher, allowEmpty = true, allowMany = true)

            val texts = uiNodes.map { it.label }.filter { it.isNotBlank() }

            Log.d("$TAG Got text from ${texts.size} matching nodes within container")
            texts
        }

    override suspend fun click(
        matcher: NodeMatcher?,
        coordinate: Point?,
        clickTypes: UiTreeClickTypes,
        retry: TaskRetry,
        strict: Boolean,
        container: NodeMatcher?,
    ) = withRetry(
        retry = retry,
        operation = if (coordinate != null) "click(${coordinate.shortString})" else "click($matcher)",
        successPayload = { _, elapsedMs, attempt ->
            payload(
                "matcher" to matcher?.toString(),
                "coordinate" to coordinate?.shortString,
                "click_type" to clickTypes.toString(),
                "elapsed_ms" to elapsedMs,
                "attempt" to attempt,
            )
        },
        failurePayload = { throwable, attempt ->
            val failurePoint =
                when {
                    throwable.message?.contains("not found") == true -> "not_found"
                    throwable.message?.contains("Click") == true && throwable.message?.contains("failed") == true -> "not_clickable"
                    throwable.message?.contains("UI tree not available") == true -> "stale_node"
                    else -> "timeout"
                }
            payload(
                "matcher" to matcher?.toString(),
                "coordinate" to coordinate?.shortString,
                "failure_point" to failurePoint,
                "attempt" to attempt,
            )
        },
    ) {
        require(coordinate == null || (!strict && container == null)) { "coordinate click cannot use strict or container" }
        if (coordinate != null) {
            Log.d("$TAG Clicking coordinate: ${coordinate.shortString}")
            val clickSuccessful = uiTreeManager.clickAt(coordinate.x.toFloat(), coordinate.y.toFloat(), clickTypes)
            if (!clickSuccessful) {
                throw IllegalStateException("Click at coordinate ${coordinate.shortString} failed")
            }
            Log.d("$TAG Successfully clicked coordinate ${coordinate.shortString}")
            return@withRetry Unit
        }

        val targetMatcher = matcher ?: throw IllegalStateException("click requires matcher or coordinate")
        Log.d("$TAG Clicking node matching: $targetMatcher")

        val uiTreeRaw =
            uiTreeInspector.getCurrentUiTree()
                ?: throw IllegalStateException("UI tree not available")

        val uiTree = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)

        val uiNode =
            actionNodes(targetMatcher, uiTree, strict, container).firstOrNull()
                ?: throw IllegalStateException("No UI node found matching criteria: $targetMatcher")

        val clickSuccessful = uiTreeManager.triggerClick(uiNode, clickTypes)
        if (!clickSuccessful) {
            throw IllegalStateException("Click on matching UI node failed")
        }

        Log.d("$TAG Successfully clicked matching node")
        Unit
    }

    override suspend fun enterText(
        matcher: NodeMatcher,
        text: String,
        submit: Boolean,
        clear: Boolean,
        retry: TaskRetry,
        strict: Boolean,
        container: NodeMatcher?,
    ) = withRetry(
        retry = retry,
        operation = "enterText($matcher)",
        successPayload = { _, elapsedMs, attempt ->
            payload(
                "matcher" to matcher.toString(),
                "clear" to clear,
                "submit" to submit,
                "text_length" to text.length,
                "elapsed_ms" to elapsedMs,
                "attempt" to attempt,
            )
        },
        failurePayload = { throwable, attempt ->
            val failurePoint =
                when {
                    throwable.message?.contains("not found") == true -> "not_found"
                    throwable.message?.contains("set text") == true -> "set_text_failed"
                    throwable.message?.contains("UI tree not available") == true -> "stale_node"
                    else -> "timeout"
                }
            payload(
                "matcher" to matcher.toString(),
                "clear" to clear,
                "submit" to submit,
                "text_length" to text.length,
                "failure_point" to failurePoint,
                "attempt" to attempt,
            )
        },
    ) {
        Log.d("$TAG Entering text into node matching: $matcher (len=${text.length}, clear=$clear, submit=$submit)")

        val uiTreeRaw =
            uiTreeInspector.getCurrentUiTree()
                ?: throw IllegalStateException("UI tree not available")

        val uiTree = uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)

        val uiNode =
            actionNodes(matcher, uiTree, strict, container).firstOrNull()
                ?: throw IllegalStateException("No UI node found matching criteria: $matcher")

        val setTextSuccessful =
            uiTreeManager.setText(
                uiNode = uiNode,
                text = text,
                submit = submit,
                clear = clear,
            )
        if (!setTextSuccessful) {
            throw IllegalStateException("Failed to set text on matching UI node")
        }

        Log.d("$TAG Successfully entered text into matching node")
        Unit
    }

    override suspend fun clickScrollTarget(
        target: NodeMatcher,
        container: NodeMatcher?,
        strict: Boolean,
        findFirstScrollableChild: Boolean,
        clickTypes: UiTreeClickTypes,
        retry: TaskRetry,
    ) {
        withRetry(retry, "clickScrollTarget($target)") {
            val tree = currentUiTreeFiltered()
            val node = scrollTarget(target, tree, container, strict, findFirstScrollableChild)
                ?: if (strict) throw StrictSelectionException("NODE_NOT_FOUND", 0, NodeResolver(tree).encodeMatches(emptyList()))
                else throw IllegalStateException("No UI node found matching criteria: $target")
            check(uiTreeManager.triggerClick(node, clickTypes)) { "Click on matching UI node failed" }
        }
    }

    override suspend fun scrollUntil(
        target: NodeMatcher,
        container: NodeMatcher?,
        direction: TaskScrollDirection,
        maxSwipes: Int,
        distanceRatio: Float,
        settleDelay: Duration,
        retry: TaskRetry,
        findFirstScrollableChild: Boolean,
        strict: Boolean,
    ): TaskScrollResult {
        var containerResolution = "exact"

        return withRetry(
            retry = retry,
            operation = "scrollUntil(target=$target)",
            successPayload = { result, elapsedMs, attempt ->
                val swipesUsed =
                    when (result) {
                        is TaskScrollResult.Found -> 0 // TODO: Track actual swipes used - requires refactoring loop counter
                        TaskScrollResult.NotFoundExhausted -> maxSwipes
                    }
                payload(
                    "target_matcher" to target.toString(),
                    "container_matcher" to (container?.toString() ?: "auto"),
                    "swipes_used" to swipesUsed,
                    "direction" to direction.toString(),
                    "axis" to
                        when (direction) {
                            TaskScrollDirection.Left, TaskScrollDirection.Right -> "horizontal"
                            else -> "vertical"
                        },
                    "container_resolution" to containerResolution,
                    "elapsed_ms" to elapsedMs,
                    "attempt" to attempt,
                )
            },
            failurePayload = { throwable, attempt ->
                val failurePoint =
                    when {
                        throwable.message?.contains("container not found") == true -> "container_not_found"
                        throwable.message?.contains("not found") == true -> "target_not_found"
                        else -> "max_swipes_exceeded"
                    }
                payload(
                    "target_matcher" to target.toString(),
                    "container_matcher" to (container?.toString() ?: "auto"),
                    "failure_point" to failurePoint,
                    "container_resolution" to containerResolution,
                    "attempt" to attempt,
                )
            },
        ) {
            // Validate parameters
            require(distanceRatio in 0f..1f) { "distanceRatio must be in [0,1], got $distanceRatio" }
            require(maxSwipes > 0) { "maxSwipes must be > 0, got $maxSwipes" }

            Log.d("$TAG Starting scrollUntil: target=$target, dir=$direction, max=$maxSwipes")

            var uiTree = currentUiTreeFiltered()
            var stuckCount = 0

            repeat(maxSwipes + 1) { swipeIndex ->
                // Refresh UI tree each pass
                uiTree = currentUiTreeFiltered()

                // Re-resolve container from the fresh tree (critical: avoid stale nodes)
                val freshScrollNode =
                    scrollNode(uiTree, container, strict, findFirstScrollableChild) ?: throw IllegalStateException("No scrollable container visible")

                // 1) Try find target without scrolling
                Log.d("$TAG scrollUntil searching for target at swipe=$swipeIndex")
                if (DEBUG_SCROLL_LOGGING) {
                    logUiTree(uiTree, "Pre-scroll UI tree (swipe=$swipeIndex)")
                }

                scrollTarget(target, uiTree, container, strict, findFirstScrollableChild)?.let { found ->
                    val taskNode = toTaskUiNode(found)
                    Log.d("$TAG scrollUntil ✅ found at swipe=$swipeIndex: $taskNode")
                    return@withRetry TaskScrollResult.Found(taskNode)
                }

                if (swipeIndex == maxSwipes) {
                    Log.d("$TAG scrollUntil ❌ not found after $maxSwipes swipes")
                    return@withRetry TaskScrollResult.NotFoundExhausted
                }

                // 2) Prepare signature to detect progress
                val sigBefore = leadingChildSignature(freshScrollNode, direction)

                // 3) Perform swipe
                val ok = gestureSwipeWithin(freshScrollNode, direction, distanceRatio)
                if (!ok) {
                    Log.d("$TAG scrollUntil gesture failed; backing off and continuing")
                    delay(settleDelay)
                    return@repeat // Continue to next iteration instead of throwing
                }

                delay(settleDelay)

                // 4) Refresh tree and re-resolve container for progress check
                val uiTreeAfter = currentUiTreeFiltered()
                val scrollNodeAfter =
                    scrollNode(uiTreeAfter, container, strict, findFirstScrollableChild, allowMissing = true)
                        ?: return@withRetry TaskScrollResult.NotFoundExhausted

                if (DEBUG_SCROLL_LOGGING) {
                    logUiTree(uiTreeAfter, "Post-scroll UI tree (swipe=${swipeIndex + 1})")
                }

                // 5) Check progress using fresh container
                val sigAfter = leadingChildSignature(scrollNodeAfter, direction)
                if (sigBefore != null && sigAfter == sigBefore) {
                    stuckCount++
                    Log.d("$TAG scrollUntil ⚠️ no movement (stuck=$stuckCount)")
                    if (stuckCount >= 2) {
                        Log.d("$TAG scrollUntil 🛑 exhausted scrolling (no further movement)")
                        return@withRetry TaskScrollResult.NotFoundExhausted
                    }
                } else {
                    stuckCount = 0
                }
            }

            Log.d("$TAG scrollUntil ❌ not found after $maxSwipes swipes")
            TaskScrollResult.NotFoundExhausted
        }
    }

    override suspend fun scrollIntoView(
        target: NodeMatcher,
        container: NodeMatcher?,
        direction: TaskScrollDirection,
        maxSwipes: Int,
        distanceRatio: Float,
        settleDelay: Duration,
        retry: TaskRetry,
        findFirstScrollableChild: Boolean,
        strict: Boolean,
    ): TaskUiNode =
        when (val result = scrollUntil(target, container, direction, maxSwipes, distanceRatio, settleDelay, retry, findFirstScrollableChild, strict)) {
            is TaskScrollResult.Found -> result.node
            TaskScrollResult.NotFoundExhausted -> throw IllegalStateException("Target node not found after scrolling: $target")
        }

    override suspend fun scrollOnce(
        container: NodeMatcher?,
        direction: TaskScrollDirection,
        distanceRatio: Float,
        settleDelay: Duration,
        retry: TaskRetry,
        findFirstScrollableChild: Boolean,
        strict: Boolean,
    ): TaskScrollOnceResult = scrollOnceForTarget(container, direction, distanceRatio, settleDelay, retry, findFirstScrollableChild, strict, null).result

    private data class ScrollSearchStep(val result: TaskScrollOnceResult, val targetFound: Boolean = false)

    private suspend fun scrollOnceForTarget(
        container: NodeMatcher?,
        direction: TaskScrollDirection,
        distanceRatio: Float,
        settleDelay: Duration,
        retry: TaskRetry,
        findFirstScrollableChild: Boolean,
        strict: Boolean,
        target: NodeMatcher?,
    ): ScrollSearchStep =
        withRetry(
            retry = retry,
            operation = "scrollOnce(dir=$direction)",
            successPayload = { result, elapsedMs, attempt ->
                payload(
                    "direction" to direction.toString(),
                    "outcome" to result.result.outcome.name.lowercase(),
                    "elapsed_ms" to elapsedMs,
                    "attempt" to attempt,
                )
            },
            failurePayload = { throwable, attempt ->
                val failurePoint =
                    when {
                        throwable.message?.contains("No scrollable container") == true ||
                            throwable.message?.contains("Container not found") == true -> "container_not_found"
                        throwable.message?.contains("Scrollable container not found") == true -> "container_not_scrollable"
                        else -> "unknown"
                    }
                payload(
                    "direction" to direction.toString(),
                    "failure_point" to failurePoint,
                    "attempt" to attempt,
                )
            },
        ) {
            require(distanceRatio in 0f..1f) { "distanceRatio must be in [0,1], got $distanceRatio" }

            val uiTree = currentUiTreeFiltered()

            // Resolve container
            val scrollNode =
                scrollNode(uiTree, container, strict, findFirstScrollableChild) ?: throw IllegalStateException("No scrollable container visible")

            val resolvedContainerId = scrollNode.resourceId
            if (target != null && scrollTarget(target, uiTree, container, strict, findFirstScrollableChild) != null) {
                return@withRetry ScrollSearchStep(TaskScrollOnceResult(TaskScrollOutcome.EdgeReached, resolvedContainerId), targetFound = true)
            }

            // Capture signature before gesture
            val sigBefore = leadingChildSignature(scrollNode, direction)

            // Dispatch gesture
            val gestureOk = gestureSwipeWithin(scrollNode, direction, distanceRatio)
            if (!gestureOk) {
                Log.d("$TAG scrollOnce: gesture rejected by OS")
                return@withRetry ScrollSearchStep(TaskScrollOnceResult(TaskScrollOutcome.GestureFailed, resolvedContainerId))
            }

            // Wait for settle
            delay(settleDelay)

            // Re-read tree and re-resolve container for signature comparison
            val uiTreeAfter = currentUiTreeFiltered()
            val scrollNodeAfter =
                scrollNode(uiTreeAfter, container, strict, findFirstScrollableChild, allowMissing = true)

            if (scrollNodeAfter == null) {
                // Container disappeared after gesture; treat as edge_reached since we cannot compare
                Log.d("$TAG scrollOnce: container lost after gesture; treating as edge_reached")
                return@withRetry ScrollSearchStep(TaskScrollOnceResult(TaskScrollOutcome.EdgeReached, resolvedContainerId))
            }

            val sigAfter = leadingChildSignature(scrollNodeAfter, direction)

            if (sigBefore == null || sigAfter == null || sigAfter == sigBefore) {
                Log.d("$TAG scrollOnce: signature unchanged - edge_reached")
                ScrollSearchStep(TaskScrollOnceResult(TaskScrollOutcome.EdgeReached, resolvedContainerId))
            } else {
                Log.d("$TAG scrollOnce: signature changed - moved")
                ScrollSearchStep(TaskScrollOnceResult(TaskScrollOutcome.Moved, resolvedContainerId))
            }
        }

    override suspend fun scrollLoop(
        target: NodeMatcher?,
        container: NodeMatcher?,
        direction: TaskScrollDirection,
        distanceRatio: Float,
        settleDelay: Duration,
        maxScrolls: Int,
        maxDuration: Duration,
        noPositionChangeThreshold: Int,
        findFirstScrollableChild: Boolean,
        strict: Boolean,
    ): TaskScrollLoopResult {
        require(maxScrolls > 0) { "maxScrolls must be > 0, got $maxScrolls" }
        require(distanceRatio in 0f..1f) { "distanceRatio must be in [0,1], got $distanceRatio" }

        Log.d("$TAG scrollLoop: dir=$direction maxScrolls=$maxScrolls maxDuration=$maxDuration")

        val uiTree = currentUiTreeFiltered()

        if (target != null) {
            val visibleTarget = scrollTarget(target, uiTree, container, strict, findFirstScrollableChild)
            if (visibleTarget != null) {
                Log.d("$TAG scrollLoop: TARGET_FOUND before scrolling")
                return TaskScrollLoopResult(
                    terminationReason = TaskScrollTerminationReason.TargetFound,
                    scrollsExecuted = 0,
                    resolvedContainerId = null,
                )
            }
        }

        // Resolve container once upfront; fail fast if not found
        val resolvedContainerId: String?
        try {
            val scrollNode = scrollNode(uiTree, container, strict, findFirstScrollableChild) ?: throw IllegalStateException("No scrollable container visible")
            resolvedContainerId = scrollNode.resourceId
        } catch (e: IllegalStateException) {
            if (e is StrictSelectionException) throw e
            val reason = when {
                e.message?.contains("Scrollable container not found") == true ->
                    TaskScrollTerminationReason.ContainerNotScrollable
                else -> TaskScrollTerminationReason.ContainerNotFound
            }
            Log.w("$TAG scrollLoop: $reason - ${e.message}")
            return TaskScrollLoopResult(
                terminationReason = reason,
                scrollsExecuted = 0,
                resolvedContainerId = null,
            )
        }

        val mark = TimeSource.Monotonic.markNow()
        var scrollsExecuted = 0
        var noMovementCount = 0

        while (true) {
            // Duration cap
            if (mark.elapsedNow() >= maxDuration) {
                Log.d("$TAG scrollLoop: MAX_DURATION_REACHED after $scrollsExecuted scrolls")
                return TaskScrollLoopResult(
                    terminationReason = TaskScrollTerminationReason.MaxDurationReached,
                    scrollsExecuted = scrollsExecuted,
                    resolvedContainerId = resolvedContainerId,
                )
            }

            // Scroll cap
            if (scrollsExecuted >= maxScrolls) {
                Log.d("$TAG scrollLoop: MAX_SCROLLS_REACHED ($maxScrolls)")
                return TaskScrollLoopResult(
                    terminationReason = TaskScrollTerminationReason.MaxScrollsReached,
                    scrollsExecuted = scrollsExecuted,
                    resolvedContainerId = resolvedContainerId,
                )
            }

            // Execute one scroll step
            val stepResult = try {
                scrollOnceForTarget(
                    container = container,
                    direction = direction,
                    distanceRatio = distanceRatio,
                    settleDelay = settleDelay,
                    retry = TaskRetry.None,
                    findFirstScrollableChild = findFirstScrollableChild,
                    strict = strict,
                    target = target,
                )
            } catch (e: IllegalStateException) {
            if (e is StrictSelectionException) throw e
                // Container lost mid-loop (app navigated away etc.) - treat as container lost
                Log.d("$TAG scrollLoop: container lost mid-loop, returning ContainerLost")
                return TaskScrollLoopResult(
                    terminationReason = TaskScrollTerminationReason.ContainerLost,
                    scrollsExecuted = scrollsExecuted,
                    resolvedContainerId = resolvedContainerId,
                )
            }

            if (stepResult.targetFound) {
                return TaskScrollLoopResult(TaskScrollTerminationReason.TargetFound, scrollsExecuted, resolvedContainerId)
            }
            scrollsExecuted++

            when (stepResult.result.outcome) {
                TaskScrollOutcome.EdgeReached -> {
                    if (target != null) {
                        if (findVisibleTargetWithGracePeriod(target, settleDelay, container, strict, findFirstScrollableChild) != null) {
                            Log.d("$TAG scrollLoop: TARGET_FOUND at edge after $scrollsExecuted scrolls")
                            return TaskScrollLoopResult(
                                terminationReason = TaskScrollTerminationReason.TargetFound,
                                scrollsExecuted = scrollsExecuted,
                                resolvedContainerId = resolvedContainerId,
                            )
                        }
                    }
                    Log.d("$TAG scrollLoop: EDGE_REACHED after $scrollsExecuted scrolls")
                    return TaskScrollLoopResult(
                        terminationReason = TaskScrollTerminationReason.EdgeReached,
                        scrollsExecuted = scrollsExecuted,
                        resolvedContainerId = resolvedContainerId,
                    )
                }
                TaskScrollOutcome.GestureFailed -> {
                    // Gesture failures count as no movement
                    noMovementCount++
                    Log.d("$TAG scrollLoop: gesture_failed (noMovement=$noMovementCount)")
                }
                TaskScrollOutcome.Moved -> {
                    noMovementCount = 0
                    if (target != null) {
                        if (findVisibleTargetWithGracePeriod(target, settleDelay, container, strict, findFirstScrollableChild) != null) {
                            Log.d("$TAG scrollLoop: TARGET_FOUND after $scrollsExecuted scrolls")
                            return TaskScrollLoopResult(
                                terminationReason = TaskScrollTerminationReason.TargetFound,
                                scrollsExecuted = scrollsExecuted,
                                resolvedContainerId = resolvedContainerId,
                            )
                        }
                    }
                }
            }

            // No-movement threshold
            if (noMovementCount >= noPositionChangeThreshold) {
                Log.d("$TAG scrollLoop: NO_POSITION_CHANGE after $scrollsExecuted scrolls (threshold=$noPositionChangeThreshold)")
                return TaskScrollLoopResult(
                    terminationReason = TaskScrollTerminationReason.NoPositionChange,
                    scrollsExecuted = scrollsExecuted,
                    resolvedContainerId = resolvedContainerId,
                )
            }
        }
    }

    private suspend fun currentUiTreeFiltered(): UiTree {
        val uiTreeRaw =
            uiTreeInspector.getCurrentUiTree()
                ?: throw IllegalStateException("UI tree not available")
        return uiTreeFilterer.filterOnScreenOnly(uiTreeRaw)
    }

    private suspend fun findVisibleTargetWithGracePeriod(
        target: NodeMatcher,
        settleDelay: Duration,
        container: NodeMatcher?,
        strict: Boolean,
        findFirstScrollableChild: Boolean,
    ): UiNode? {
        val initialTree = currentUiTreeFiltered()
        scrollTarget(target, initialTree, container, strict, findFirstScrollableChild)?.let { return it }

        val pollDelay =
            (settleDelay / 2)
                .coerceAtLeast(100.milliseconds)
                .coerceAtMost(500.milliseconds)

        repeat(3) {
            delay(pollDelay)
            val uiTree = currentUiTreeFiltered()
            scrollTarget(target, uiTree, container, strict, findFirstScrollableChild)?.let { return it }
        }

        return null
    }

    private fun isScrollable(uiNode: UiNode): Boolean = uiNode.hints["scrollable"] == "true"

    private suspend fun gestureSwipeWithin(
        uiNode: UiNode,
        direction: TaskScrollDirection,
        distanceRatio: Float,
    ): Boolean =
        when (direction) {
            TaskScrollDirection.Down, TaskScrollDirection.Up ->
                gestureSwipeWithinVertical(uiNode, direction, distanceRatio)
            TaskScrollDirection.Left, TaskScrollDirection.Right ->
                gestureSwipeWithinHorizontal(uiNode, direction, distanceRatio)
        }

    private suspend fun gestureSwipeWithinVertical(
        uiNode: UiNode,
        direction: TaskScrollDirection,
        distanceRatio: Float,
    ): Boolean {
        val (startYRatio, endYRatio) =
            when (direction) {
                TaskScrollDirection.Down -> {
                    val start = 0.8f - (distanceRatio * 0.4f) // Start higher for down scroll
                    val end = start - (distanceRatio * 0.4f) // End lower
                    start to end
                }
                TaskScrollDirection.Up -> {
                    val start = 0.2f + (distanceRatio * 0.4f) // Start lower for up scroll
                    val end = start + (distanceRatio * 0.4f) // End higher
                    start to end
                }
                else -> error("Invalid vertical direction: $direction")
            }

        require(startYRatio in 0f..1f) { "Computed startYRatio must be in [0,1], got $startYRatio" }
        require(endYRatio in 0f..1f) { "Computed endYRatio must be in [0,1], got $endYRatio" }

        return uiTreeManager.swipeWithinVertical(uiNode, startYRatio, endYRatio)
    }

    private suspend fun gestureSwipeWithinHorizontal(
        uiNode: UiNode,
        direction: TaskScrollDirection,
        distanceRatio: Float,
    ): Boolean {
        // NOTE: Horizontal carousels often invert finger vs content direction.
        // Left = move content left (reveal right) → finger swipes RIGHT; Right → finger LEFT.
        val (startXRatio, endXRatio) =
            when (direction) {
                TaskScrollDirection.Left -> {
                    // TaskScrollDirection.Left = scroll content LEFT (reveal items to RIGHT)
                    // Requires swiping RIGHT on screen: start left-ish, end right-ish
                    val start = 0.2f + (distanceRatio * 0.4f)
                    val end = start + (distanceRatio * 0.4f)
                    start to end
                }
                TaskScrollDirection.Right -> {
                    // TaskScrollDirection.Right = scroll content RIGHT (reveal items to LEFT)
                    // Requires swiping LEFT on screen: start right-ish, end left-ish
                    val start = 0.8f - (distanceRatio * 0.4f)
                    val end = start - (distanceRatio * 0.4f)
                    start to end
                }
                else -> error("Invalid horizontal direction: $direction")
            }

        require(startXRatio in 0f..1f) { "Computed startXRatio must be in [0,1], got $startXRatio" }
        require(endXRatio in 0f..1f) { "Computed endXRatio must be in [0,1], got $endXRatio" }

        return uiTreeManager.swipeWithinHorizontal(uiNode, startXRatio, endXRatio)
    }

    /**
     * Creates a signature from the leading children to detect scroll progress.
     * Uses top children for vertical scrolling, left children for horizontal scrolling.
     */
    private fun leadingChildSignature(
        container: UiNode,
        direction: TaskScrollDirection,
    ): String? {
        val leading3 = container.children.take(3)
        if (leading3.isEmpty()) return null

        return when (direction) {
            TaskScrollDirection.Down, TaskScrollDirection.Up ->
                leading3.joinToString("|") { "${it.resourceId ?: it.id.value}@y=${it.bounds.top}" }
            TaskScrollDirection.Left, TaskScrollDirection.Right ->
                leading3.joinToString("|") { "${it.resourceId ?: it.id.value}@x=${it.bounds.left}" }
        }
    }

    private fun toTaskUiNode(uiNode: UiNode): TaskUiNode =
        TaskUiNode(
            resourceId = uiNode.resourceId,
            label = uiNode.label,
            contentDescription = uiNode.contentDescription,
            clickable = uiNode.isClickable,
            role = uiNode.role.name.lowercase(),
            bounds = uiNode.bounds,
            debugPath = uiNode.id.value,
        )

    private suspend fun logUiTree(
        uiTree: UiTree,
        label: String,
    ) {
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
        Log.d("$TAG $label:\n$treeLog")
    }

    override suspend fun getCurrentToggleState(
        target: NodeMatcher,
        retry: TaskRetry,
    ): ToggleState =
        withRetry(
            retry = retry,
            operation = "getCurrentToggleState($target)",
            successPayload = { state, elapsedMs, attempt ->
                payload(
                    "target_matcher" to target.toString(),
                    "detected_state" to state.toString(),
                    "elapsed_ms" to elapsedMs,
                    "attempt" to attempt,
                )
            },
            failurePayload = { throwable, attempt ->
                val failurePoint =
                    when {
                        throwable.message?.contains("UI tree not available") == true -> "ui_tree_unavailable"
                        throwable.message?.contains("No UI node found") == true -> "toggle_container_not_found"
                        throwable.message?.contains("Toggle state could not be determined") == true -> "toggle_state_undetermined"
                        throwable.message?.contains("Click") == true && throwable.message?.contains("failed") == true -> "button_not_clickable"
                        else -> "unknown_error"
                    }
                payload(
                    "target_matcher" to target.toString(),
                    "failure_point" to failurePoint,
                    "attempt" to attempt,
                )
            },
        ) {
            Log.d("$TAG Getting current toggle state for target: $target")

            val uiTree = currentUiTreeFiltered()

            // Find the container using the NodeMatcher
            val container =
                NodeResolver(uiTree).resolve(target).firstOrNull()?.node ?: throw IllegalStateException("No UI node found matching criteria: $target")

            // Create a temporary sub-tree rooted at the container to search within
            val subTree = uiTree.copy(root = container)
            val state = subTree.inferOnOffState()

            if (state == ToggleState.Unknown) {
                Log.d("$TAG Toggle state detection returned Unknown for target: $target")
                throw IllegalStateException("Toggle state could not be determined for target: $target")
            }

            Log.d("$TAG ✅ Detected toggle state: $state")
            state
        }

    override suspend fun setCurrentToggleState(
        target: NodeMatcher,
        desiredState: ToggleState,
        retry: TaskRetry,
    ): ToggleState =
        withRetry(
            retry = retry,
            operation = "setCurrentToggleState($target, $desiredState)",
            successPayload = { state, elapsedMs, attempt ->
                payload(
                    "target_matcher" to target.toString(),
                    "desired_state" to desiredState.toString(),
                    "final_state" to state.toString(),
                    "elapsed_ms" to elapsedMs,
                    "attempt" to attempt,
                )
            },
            failurePayload = { throwable, attempt ->
                val failurePoint =
                    when {
                        throwable.message?.contains("UI tree not available") == true -> "ui_tree_unavailable"
                        throwable.message?.contains("No UI node found") == true -> "toggle_container_not_found"
                        throwable.message?.contains("Cannot click") == true -> "button_not_clickable"
                        else -> "unknown_error"
                    }
                payload(
                    "target_matcher" to target.toString(),
                    "desired_state" to desiredState.toString(),
                    "failure_point" to failurePoint,
                    "attempt" to attempt,
                )
            },
        ) {
            require(desiredState != ToggleState.Unknown) { "Cannot set toggle to Unknown state" }
            Log.d("$TAG Setting toggle state for target: $target to desired state: $desiredState")

            // First, get the current state
            val currentState = getCurrentToggleState(target, TaskRetry.None)
            Log.d("$TAG Current toggle state: $currentState")

            // If already in desired state, return it
            if (currentState == desiredState) {
                Log.d("$TAG Toggle already in desired state: $desiredState")
                return@withRetry currentState
            }

            // Determine which button to click based on desired state
            val buttonLabel =
                when (desiredState) {
                    ToggleState.On -> "On"
                    ToggleState.Off -> "Off"
                    ToggleState.Unknown -> {
                        Log.d("$TAG Cannot set toggle to Unknown state")
                        return@withRetry currentState
                    }
                }

            Log.d("$TAG Clicking '$buttonLabel' button to set toggle to $desiredState")

            // Find the container and locate the exact button to click
            val buttonToClick =
                findButtonInContainer(target, buttonLabel)
                    ?: throw IllegalStateException("Could not find '$buttonLabel' button in toggle container")

            // Click the exact button directly to avoid ambiguity
            clickExact(
                node = buttonToClick,
                clickTypes = UiTreeClickTypes.Default,
            )

            Log.d("$TAG Successfully clicked '$buttonLabel' button")

            // Wait a moment for the UI to update
            delay(500.milliseconds)

            // Get the final state after clicking
            val finalState = getCurrentToggleState(target, TaskRetry.None)
            Log.d("$TAG Final toggle state after clicking: $finalState")

            if (finalState == desiredState) {
                Log.d("$TAG ✅ Successfully set toggle to desired state: $desiredState")
            } else {
                Log.d("$TAG ⚠️ Toggle state did not change to desired state. Current: $finalState, Desired: $desiredState")
            }

            finalState
        }

    /**
     * Helper method to find a specific button within a toggle container.
     * Returns the exact UiNode to click directly, avoiding ambiguity with global matchers.
     *
     * @param containerMatcher NodeMatcher for finding the toggle container
     * @param buttonLabel The label of the button to find ("On" or "Off")
     * @return The exact UiNode to click, or null if not found
     */
    private suspend fun findButtonInContainer(
        containerMatcher: NodeMatcher,
        buttonLabel: String,
    ): UiNode? {
        val uiTree = currentUiTreeFiltered()

        // Find the container
        val container =
            NodeResolver(uiTree).resolve(containerMatcher).firstOrNull()?.node ?: return null

        // Create a temporary sub-tree rooted at the container to search within
        val subTree = uiTree.copy(root = container)

        // Find the exact button to click
        return UiTreeTraversal.findFirst(subTree) { uiNode ->
            uiNode.role == UiRole.Button && uiNode.label.equals(buttonLabel, ignoreCase = true)
        }
    }

    /**
     * Click a specific UiNode directly with consistent telemetry.
     * This provides the same logging and error handling as the regular click() method,
     * but operates on an already-resolved UiNode to avoid ambiguity.
     *
     * @param node The exact UiNode to click
     * @param clickTypes The type of click to perform
     */
    private suspend fun clickExact(
        node: UiNode,
        clickTypes: UiTreeClickTypes,
    ) {
        Log.d("$TAG Clicking exact node: ${node.label} (${node.role})")

        val clickSuccessful = uiTreeManager.triggerClick(node, clickTypes)
        if (!clickSuccessful) {
            Log.d("$TAG Click failed on node: ${node.label}")
            throw IllegalStateException("Click on node '${node.label}' failed")
        }

        Log.d("$TAG Successfully clicked exact node: ${node.label}")
    }
}

private fun resolveKeyValuePair(
    uiTree: UiTree,
    labelMatcher: NodeMatcher,
): Pair<String, String> {
    val labelNode = findNodeByMatcherForKeyValue(labelMatcher, uiTree)
        ?: throw IllegalStateException("NODE_NOT_FOUND")

    val path = mutableListOf<UiNode>()
    fun getPathTo(current: UiNode): Boolean {
        path.add(current)
        if (current.id == labelNode.id) return true
        for (child in current.children) {
            if (getPathTo(child)) return true
        }
        path.removeAt(path.size - 1)
        return false
    }
    if (!getPathTo(uiTree.root)) {
        throw IllegalStateException("NODE_NOT_FOUND")
    }

    for (i in path.size - 2 downTo 0) {
        val parent = path[i]
        val childInPath = path[i + 1]
        val siblingsAfter = parent.children.dropWhile { it.id != childInPath.id }.drop(1)

        if (parent.role.isKeyValueRowBoundary()) {
            if (siblingsAfter.isEmpty()) {
                throw IllegalStateException("VALUE_NODE_NOT_FOUND")
            }
            val descendants = siblingsAfter.flatMap(::flattenUiNodeSubtree).filter { it.label.isNotBlank() }
            val valueNode =
                descendants.firstOrNull { it.resourceId?.endsWith("/summary") == true } ?: descendants.firstOrNull()
                    ?: throw IllegalStateException("VALUE_NODE_NOT_FOUND")
            return labelNode.label.ifBlank { labelNode.contentDescription ?: "" } to valueNode.label
        }

        if (siblingsAfter.isNotEmpty()) {
            val descendants = siblingsAfter.flatMap(::flattenUiNodeSubtree).filter { it.label.isNotBlank() }
            val valueNode =
                descendants.firstOrNull { it.resourceId?.endsWith("/summary") == true } ?: descendants.firstOrNull()
                    ?: throw IllegalStateException("VALUE_NODE_NOT_FOUND")
            return labelNode.label.ifBlank { labelNode.contentDescription ?: "" } to valueNode.label
        }
    }

    throw IllegalStateException("VALUE_NODE_NOT_FOUND")
}

private fun flattenUiNodeSubtree(node: UiNode): List<UiNode> {
    val nodes = mutableListOf<UiNode>()

    fun collect(current: UiNode) {
        nodes.add(current)
        current.children.forEach(::collect)
    }

    collect(node)
    return nodes
}

private fun findNodeByMatcherForKeyValue(
    matcher: NodeMatcher,
    uiTree: UiTree,
): UiNode? = NodeResolver(uiTree).resolve(matcher).firstOrNull()?.node

private fun UiRole.isKeyValueRowBoundary(): Boolean =
    this == UiRole.Row || this == UiRole.ListItem || this == UiRole.Card
