package clawperator.task.runner

import action.log.Log
import action.developeroptions.DeveloperOptionsManager
import clawperator.uitree.UiTreeClickType
import clawperator.uitree.UiTreeClickTypes
import kotlinx.coroutines.flow.first
import kotlin.time.Duration.Companion.milliseconds

interface UiActionEngine {
    suspend fun execute(
        taskScope: TaskScope,
        plan: UiActionPlan,
    ): UiActionExecutionResult
}

class UiActionEngineDefault(
    private val developerOptionsManager: DeveloperOptionsManager,
    private val globalActionDispatcher: UiGlobalActionDispatcher,
    private val recordingManager: RecordingManager = RecordingManagerNoOp,
) : UiActionEngine {
    companion object {
        private const val TAG = "[UiActionEngine]"
    }

    override suspend fun execute(
        taskScope: TaskScope,
        plan: UiActionPlan,
    ): UiActionExecutionResult {
        val stepResults = mutableListOf<UiActionStepResult>()

        for (action in plan.actions) {
            val stepResult = executeSingle(taskScope, action)
            stepResults += stepResult
        }

        return UiActionExecutionResult(
            commandId = plan.commandId,
            taskId = plan.taskId,
            stepResults = stepResults,
        )
    }

    private suspend fun executeSingle(
        taskScope: TaskScope,
        action: UiAction,
    ): UiActionStepResult {
        Log.d(
            "$TAG step_start id=${action.id} type=${action::class.simpleName}",
        )

        val result =
            when (action) {
                is UiAction.OpenUri -> executeOpenUri(taskScope, action)
                is UiAction.OpenApp -> executeOpenApp(taskScope, action)
                is UiAction.CloseApp -> executeCloseApp(taskScope, action)
                is UiAction.WaitForNode -> executeWaitForNode(taskScope, action)
                is UiAction.Click -> executeClick(taskScope, action)
                is UiAction.ScrollAndClick -> executeScrollAndClick(taskScope, action)
                is UiAction.Scroll -> executeScroll(taskScope, action)
                is UiAction.ScrollUntil -> executeScrollUntil(taskScope, action)
                is UiAction.ReadText -> executeReadText(taskScope, action)
                is UiAction.SnapshotUi -> executeSnapshotUi(taskScope, action)
                is UiAction.StartRecording -> executeStartRecording(action)
                is UiAction.StopRecording -> executeStopRecording(action)
                is UiAction.TakeScreenshot -> executeTakeScreenshot(taskScope, action)
                is UiAction.EnterText -> executeEnterText(taskScope, action)
                is UiAction.Sleep -> executeSleep(taskScope, action)
                is UiAction.DoctorPing -> executeDoctorPing(taskScope, action)
                is UiAction.PressKey -> executePressKey(action)
                is UiAction.WaitForNavigation -> executeWaitForNavigation(taskScope, action)
                is UiAction.ReadKeyValuePair -> executeReadKeyValuePair(taskScope, action)
            }

        Log.d(
            // TODO(operator): result.data can contain raw read_text content. Keep this for debugging
            // while agent recipes are being stabilized, then replace with redacted/safe logging.
            "$TAG step_success id=${action.id} type=${action::class.simpleName} data=${result.data}",
        )
        return result
    }

    private suspend fun executeOpenUri(
        taskScope: TaskScope,
        action: UiAction.OpenUri,
    ): UiActionStepResult {
        taskScope.openUri(action.uri, action.retry)
        return UiActionStepResult(
            id = action.id,
            actionType = "open_uri",
            data = mapOf("uri" to action.uri),
        )
    }

    private suspend fun executeOpenApp(
        taskScope: TaskScope,
        action: UiAction.OpenApp,
    ): UiActionStepResult {
        taskScope.openApp(action.applicationId, action.retry)
        return UiActionStepResult(
            id = action.id,
            actionType = "open_app",
            data = mapOf("application_id" to action.applicationId),
        )
    }

    private suspend fun executeCloseApp(
        taskScope: TaskScope,
        action: UiAction.CloseApp,
    ): UiActionStepResult {
        // The Android runtime cannot reliably force-stop other apps due to sandbox restrictions.
        // We return an error here to signal that the 'Hand' (Node CLI) should have handled this via ADB.
        return UiActionStepResult(
            id = action.id,
            actionType = "close_app",
            success = false,
            data = mapOf(
                "application_id" to action.applicationId,
                "error" to "UNSUPPORTED_RUNTIME_CLOSE",
                "message" to "Android runtime cannot reliably close apps. Use the Clawperator Node API or 'adb shell am force-stop' directly for this action."
            ),
        )
    }

    private suspend fun executeWaitForNavigation(
        taskScope: TaskScope,
        action: UiAction.WaitForNavigation,
    ): UiActionStepResult {
        val result = taskScope.waitForNavigation(
            expectedPackage = action.expectedPackage,
            expectedNode = action.expectedNode,
            timeoutMs = action.timeoutMs,
        )

        return if (result.success) {
            UiActionStepResult(
                id = action.id,
                actionType = "wait_for_navigation",
                data = buildMap {
                    result.lastPackage?.let { put("resolved_package", it) }
                    put("elapsed_ms", result.elapsedMs.toString())
                },
            )
        } else {
            UiActionStepResult(
                id = action.id,
                actionType = "wait_for_navigation",
                success = false,
                data = buildMap {
                    put("error", "NAVIGATION_TIMEOUT")
                    result.lastPackage?.let { put("last_package", it) }
                },
            )
        }
    }

    private suspend fun executeReadKeyValuePair(
        taskScope: TaskScope,
        action: UiAction.ReadKeyValuePair,
    ): UiActionStepResult {
        return try {
            val (label, value) = taskScope.ui {
                readKeyValuePair(action.labelMatcher, action.retry)
            }
            UiActionStepResult(
                id = action.id,
                actionType = "read_key_value_pair",
                data = mapOf(
                    "label" to label,
                    "value" to value,
                ),
            )
        } catch (e: IllegalStateException) {
            val errorCode = when (e.message) {
                "NODE_NOT_FOUND" -> "NODE_NOT_FOUND"
                "VALUE_NODE_NOT_FOUND" -> "VALUE_NODE_NOT_FOUND"
                else -> throw e
            }
            UiActionStepResult(
                id = action.id,
                actionType = "read_key_value_pair",
                success = false,
                data = mapOf("error" to errorCode),
            )
        }
    }

    private suspend fun executeWaitForNode(
        taskScope: TaskScope,
        action: UiAction.WaitForNode,
    ): UiActionStepResult {
        val node =
            taskScope.ui {
                waitForNode(action.matcher, action.retry, action.timeoutMs)
            }

        return UiActionStepResult(
            id = action.id,
            actionType = "wait_for_node",
            data =
                buildMap {
                    put("resource_id", node.resourceId ?: "")
                    put("label", node.label)
                    action.timeoutMs?.let { put("timeout_ms", it.toString()) }
                },
        )
    }

    private suspend fun executeClick(
        taskScope: TaskScope,
        action: UiAction.Click,
    ): UiActionStepResult {
        taskScope.ui {
            click(
                matcher = action.matcher,
                clickTypes = action.clickTypes,
                retry = action.retry,
            )
        }
        return UiActionStepResult(
            id = action.id,
            actionType = "click",
            data =
                mapOf(
                    "click_types" to action.clickTypes.toWireValue(),
                ),
        )
    }

    private suspend fun executeScrollAndClick(
        taskScope: TaskScope,
        action: UiAction.ScrollAndClick,
    ): UiActionStepResult {
        taskScope.ui {
            clickAfterScroll(
                target = action.matcher,
                container = action.container,
                clickTypes = action.clickTypes,
                direction = action.direction,
                maxSwipes = action.maxSwipes,
                distanceRatio = action.distanceRatio,
                settleDelay = action.settleDelayMs.milliseconds,
                scrollRetry = action.scrollRetry,
                clickRetry = action.clickRetry,
                findFirstScrollableChild = action.findFirstScrollableChild,
                clickAfter = action.clickAfter,
            )
        }

        return UiActionStepResult(
            id = action.id,
            actionType = "scroll_and_click",
            data =
                mapOf(
                    "max_swipes" to action.maxSwipes.toString(),
                    "direction" to action.direction.toString(),
                    "click_types" to action.clickTypes.toWireValue(),
                    "click_after" to action.clickAfter.toString(),
                ),
        )
    }

    private suspend fun executeScroll(
        taskScope: TaskScope,
        action: UiAction.Scroll,
    ): UiActionStepResult {
        return try {
            val result =
                taskScope.ui {
                    scrollOnce(
                        container = action.container,
                        direction = action.direction,
                        distanceRatio = action.distanceRatio,
                        settleDelay = action.settleDelayMs.milliseconds,
                        retry = action.retry,
                        findFirstScrollableChild = action.findFirstScrollableChild,
                    )
                }
            val baseData = buildMap<String, String> {
                put("scroll_outcome", result.outcome.toWireValue())
                put("direction", action.direction.name.lowercase())
                put("distance_ratio", action.distanceRatio.toString())
                put("settle_delay_ms", action.settleDelayMs.toString())
                result.resolvedContainerId?.let { put("resolved_container", it) }
            }
            when (result.outcome) {
                TaskScrollOutcome.Moved, TaskScrollOutcome.EdgeReached ->
                    UiActionStepResult(
                        id = action.id,
                        actionType = "scroll",
                        success = true,
                        data = baseData,
                    )
                TaskScrollOutcome.GestureFailed ->
                    UiActionStepResult(
                        id = action.id,
                        actionType = "scroll",
                        success = false,
                        data = baseData + mapOf("error" to "GESTURE_FAILED"),
                    )
            }
        } catch (e: IllegalStateException) {
            val message = e.message ?: ""
            val errorCode =
                when {
                    message.contains("Scrollable container not found") -> "CONTAINER_NOT_SCROLLABLE"
                    else -> "CONTAINER_NOT_FOUND"
                }
            Log.w("$TAG executeScroll: $errorCode - ${e.message}")
            UiActionStepResult(
                id = action.id,
                actionType = "scroll",
                success = false,
                data =
                    mapOf(
                        "error" to errorCode,
                        "direction" to action.direction.name.lowercase(),
                        "settle_delay_ms" to action.settleDelayMs.toString(),
                    ),
            )
        }
    }

    private suspend fun executeScrollUntil(
        taskScope: TaskScope,
        action: UiAction.ScrollUntil,
    ): UiActionStepResult {
        val initialResult =
            taskScope.ui {
                scrollLoop(
                    target = action.matcher,
                    container = action.container,
                    direction = action.direction,
                    distanceRatio = action.distanceRatio,
                    settleDelay = action.settleDelayMs.milliseconds,
                    maxScrolls = action.maxScrolls,
                    maxDuration = action.maxDurationMs.milliseconds,
                    noPositionChangeThreshold = action.noPositionChangeThreshold,
                    findFirstScrollableChild = action.findFirstScrollableChild,
                )
            }

        val result =
            if (
                action.matcher != null &&
                (initialResult.terminationReason == TaskScrollTerminationReason.EdgeReached ||
                    initialResult.terminationReason == TaskScrollTerminationReason.MaxScrollsReached ||
                    initialResult.terminationReason == TaskScrollTerminationReason.MaxDurationReached ||
                    initialResult.terminationReason == TaskScrollTerminationReason.NoPositionChange)
            ) {
                val targetVisibleAfterLoop =
                    try {
                        taskScope.ui {
                            waitForNode(
                                matcher = action.matcher,
                                retry = TaskRetryPresets.UiReadiness,
                            )
                        }
                        true
                    } catch (_: IllegalStateException) {
                        false
                    }

                if (targetVisibleAfterLoop) {
                    initialResult.copy(terminationReason = TaskScrollTerminationReason.TargetFound)
                } else {
                    initialResult
                }
            } else {
                initialResult
            }

        val isError = result.terminationReason == TaskScrollTerminationReason.ContainerNotFound ||
            result.terminationReason == TaskScrollTerminationReason.ContainerNotScrollable ||
            result.terminationReason == TaskScrollTerminationReason.ContainerLost

        if (!isError &&
            action.clickAfter &&
            result.terminationReason == TaskScrollTerminationReason.TargetFound &&
            action.matcher != null
        ) {
            taskScope.ui {
                click(
                    matcher = action.matcher,
                    clickTypes = action.clickTypes,
                    retry = TaskRetryPresets.UiReadiness,
                )
            }
        }

        val data = buildMap<String, String> {
            put("termination_reason", result.terminationReason.toWireValue())
            put("scrolls_executed", result.scrollsExecuted.toString())
            put("direction", action.direction.name.lowercase())
            put("click_after", action.clickAfter.toString())
            put("click_types", action.clickTypes.toWireValue())
            result.resolvedContainerId?.let { put("resolved_container", it) }
            if (isError) put("error", result.terminationReason.toWireValue())
        }

        return UiActionStepResult(
            id = action.id,
            actionType = "scroll_until",
            success = !isError,
            data = data,
        )
    }

    private suspend fun executeReadText(
        taskScope: TaskScope,
        action: UiAction.ReadText,
    ): UiActionStepResult {
        return try {
            if (action.all) {
                // Multi-match mode: get all matching nodes' text
                val texts = taskScope.ui {
                    getAllText(matcher = action.matcher, retry = action.retry)
                }

                // Return as JSON array string
                val jsonArray = texts.joinToString(
                    prefix = "[",
                    postfix = "]",
                    separator = ",",
                ) { "\"${it.replace("\\", "\\\\").replace("\"", "\\\"")}\"" }

                UiActionStepResult(
                    id = action.id,
                    actionType = "read_text",
                    data =
                        mapOf(
                            "text" to jsonArray,
                            "all" to "true",
                            "count" to texts.size.toString(),
                            "validator" to "none",
                        ),
                )
            } else {
                // Single-match mode (original behavior)
                val text =
                    taskScope.ui {
                        when (action.validator) {
                            null -> getText(matcher = action.matcher, retry = action.retry)
                            UiTextValidator.Temperature ->
                                getValidatedText(
                                    matcher = action.matcher,
                                    retry = action.retry,
                                    validator = TaskValidators.TemperatureValidator,
                                )
                            UiTextValidator.Version ->
                                getValidatedText(
                                    matcher = action.matcher,
                                    retry = action.retry,
                                    validator = TaskValidators.VersionValidator,
                                )
                            UiTextValidator.Regex -> {
                                val regex = Regex(checkNotNull(action.validatorPattern) { "validatorPattern required for Regex validator" })
                                getValidatedText(
                                    matcher = action.matcher,
                                    retry = action.retry,
                                    validator = { it.matches(regex) },
                                )
                            }
                        }
                    }

                UiActionStepResult(
                    id = action.id,
                    actionType = "read_text",
                    data =
                        mapOf(
                            "text" to text,
                            "validator" to (action.validator?.name?.lowercase() ?: "none"),
                        ),
                )
            }
        } catch (e: IllegalStateException) {
            val msg = e.message ?: ""
            // All validators should return VALIDATOR_MISMATCH on validation failure.
            // NOTE: This extraction depends on the exact message format from getValidatedText.
            // If that message changes, rawText extraction will silently fail (empty string).
            // Consider throwing a typed wrapper exception from getValidatedText to decouple.
            if (msg.contains("Validation failed for text") && action.validator != null) {
                val match = Regex("Validation failed for text '(.*)' from").find(msg)
                val rawText = match?.groupValues?.get(1) ?: ""
                return UiActionStepResult(
                    id = action.id,
                    actionType = "read_text",
                    success = false,
                    data = mapOf(
                        "error" to "VALIDATOR_MISMATCH",
                        "raw_text" to rawText,
                    ),
                )
            }
            throw e
        } catch (e: IllegalArgumentException) {
            // Regex constructor throws PatternSyntaxException (extends IllegalArgumentException)
            // for invalid patterns. Return structured error instead of crashing.
            if (action.validator == UiTextValidator.Regex) {
                return UiActionStepResult(
                    id = action.id,
                    actionType = "read_text",
                    success = false,
                    data = mapOf(
                        "error" to "INVALID_REGEX_PATTERN",
                        "message" to (e.message ?: "Invalid regex pattern"),
                    ),
                )
            }
            throw e
        }
    }

    private suspend fun executeSnapshotUi(
        taskScope: TaskScope,
        action: UiAction.SnapshotUi,
    ): UiActionStepResult {
        // Snapshot action routes through TaskScope.logUiTree, the same core path used for UI hierarchy dumps.
        val snapshotResult = taskScope.logUiTree(retry = action.retry)

        return UiActionStepResult(
            id = action.id,
            actionType = "snapshot_ui",
            data =
                mapOf(
                    "actual_format" to snapshotResult.actualFormat.wireValue,
                ).let { base ->
                    buildMap {
                        putAll(base)
                        snapshotResult.foregroundPackage?.let { put("foreground_package", it) }
                        put("has_overlay", snapshotResult.hasOverlay.toString())
                        snapshotResult.overlayPackage?.let { put("overlay_package", it) }
                        snapshotResult.windowCount?.let { put("window_count", it.toString()) }
                    }
                },
        )
    }

    private suspend fun executeStartRecording(action: UiAction.StartRecording): UiActionStepResult =
        when (val outcome = recordingManager.startRecording(action.sessionId)) {
            is RecordingCommandOutcome.Started ->
                UiActionStepResult(
                    id = action.id,
                    actionType = "start_recording",
                    data =
                        buildMap {
                            put("sessionId", outcome.sessionId)
                            put("filePath", outcome.filePath)
                        },
                )
            is RecordingCommandOutcome.Error ->
                UiActionStepResult(
                    id = action.id,
                    actionType = "start_recording",
                    success = false,
                    data =
                        buildMap {
                            put("error", outcome.code)
                            put("message", outcome.message)
                            outcome.sessionId?.let { put("sessionId", it) }
                            outcome.filePath?.let { put("filePath", it) }
                        },
                )
            is RecordingCommandOutcome.Stopped ->
                UiActionStepResult(
                    id = action.id,
                    actionType = "start_recording",
                    success = false,
                    data = mapOf("error" to "RECORDING_START_FAILED", "message" to "Unexpected stop result from RecordingManager"),
                )
        }

    private suspend fun executeStopRecording(action: UiAction.StopRecording): UiActionStepResult =
        when (val outcome = recordingManager.stopRecording(action.sessionId)) {
            is RecordingCommandOutcome.Stopped ->
                UiActionStepResult(
                    id = action.id,
                    actionType = "stop_recording",
                    data =
                        buildMap {
                            put("sessionId", outcome.sessionId)
                            put("filePath", outcome.filePath)
                            put("eventCount", outcome.eventCount.toString())
                        },
                )
            is RecordingCommandOutcome.Error ->
                UiActionStepResult(
                    id = action.id,
                    actionType = "stop_recording",
                    success = false,
                    data =
                        buildMap {
                            put("error", outcome.code)
                            put("message", outcome.message)
                            outcome.sessionId?.let { put("sessionId", it) }
                            outcome.filePath?.let { put("filePath", it) }
                            outcome.eventCount?.let { put("eventCount", it.toString()) }
                        },
                )
            is RecordingCommandOutcome.Started ->
                UiActionStepResult(
                    id = action.id,
                    actionType = "stop_recording",
                    success = false,
                    data = mapOf("error" to "RECORDING_STOP_FAILED", "message" to "Unexpected start result from RecordingManager"),
                )
        }

    private suspend fun executeTakeScreenshot(
        taskScope: TaskScope,
        action: UiAction.TakeScreenshot,
    ): UiActionStepResult {
        // The Android runtime cannot reliably take screenshots of the system/other apps due to security restrictions.
        // We return an error here to signal that the 'Hand' (Node CLI) should handle this via ADB.
        return UiActionStepResult(
            id = action.id,
            actionType = "take_screenshot",
            success = false,
            data = mapOf(
                "error" to "UNSUPPORTED_RUNTIME_SCREENSHOT",
                "message" to "Android runtime cannot reliably capture screenshots. Use the Clawperator Node API or 'adb exec-out screencap -p' directly for this action."
            ),
        )
    }

    private suspend fun executeEnterText(
        taskScope: TaskScope,
        action: UiAction.EnterText,
    ): UiActionStepResult {
        taskScope.ui {
            enterText(
                matcher = action.matcher,
                text = action.text,
                submit = action.submit,
                retry = action.retry,
            )
        }
        return UiActionStepResult(
            id = action.id,
            actionType = "enter_text",
            data =
                mapOf(
                    "text" to action.text,
                    "submit" to action.submit.toString(),
                ),
        )
    }

    private suspend fun executeSleep(
        taskScope: TaskScope,
        action: UiAction.Sleep,
    ): UiActionStepResult {
        require(action.durationMs >= 0L) { "durationMs must be >= 0" }
        taskScope.pause(action.durationMs.milliseconds, action.retry)
        return UiActionStepResult(
            id = action.id,
            actionType = "sleep",
            data = mapOf("duration_ms" to action.durationMs.toString()),
        )
    }

    private suspend fun executeDoctorPing(
        taskScope: TaskScope,
        action: UiAction.DoctorPing,
    ): UiActionStepResult {
        val optionsEnabled = developerOptionsManager.isEnabled.first()
        val usbDebuggingEnabled = developerOptionsManager.isUsbDebuggingEnabled.first()
        return UiActionStepResult(
            id = action.id,
            actionType = "doctor_ping",
            data = mapOf(
                "developer_options_enabled" to optionsEnabled.toString(),
                "usb_debugging_enabled" to usbDebuggingEnabled.toString(),
            ),
        )
    }

    private fun executePressKey(action: UiAction.PressKey): UiActionStepResult {
        val keyName = action.key.name.lowercase()
        val success = globalActionDispatcher.perform(action.key)

        return if (success) {
            UiActionStepResult(
                id = action.id,
                actionType = "press_key",
                data = mapOf("key" to keyName),
            )
        } else {
            Log.w("$TAG executePressKey: performGlobalAction returned false for key=$keyName")
            UiActionStepResult(
                id = action.id,
                actionType = "press_key",
                success = false,
                data = mapOf(
                    "key" to keyName,
                    "error" to "GLOBAL_ACTION_FAILED",
                ),
            )
        }
    }
}

/**
 * Returns a stable canonical wire value for the click types (e.g. "click", "long_click", "focus").
 * Uses the first type in [UiTreeClickTypes.ordered] so multi-type lists are representable in data output.
 */
private fun UiTreeClickTypes.toWireValue(): String =
    when (ordered.firstOrNull()) {
        UiTreeClickType.LongClick -> "long_click"
        UiTreeClickType.Focus -> "focus"
        else -> "click"
    }

/**
 * Returns the stable canonical wire value for a scroll outcome.
 * Enum names use camel case; wire values use snake_case for consistency with the rest of the API.
 */
private fun TaskScrollOutcome.toWireValue(): String =
    when (this) {
        TaskScrollOutcome.Moved -> "moved"
        TaskScrollOutcome.EdgeReached -> "edge_reached"
        TaskScrollOutcome.GestureFailed -> "gesture_failed"
    }

private fun TaskScrollTerminationReason.toWireValue(): String =
    when (this) {
        TaskScrollTerminationReason.TargetFound -> "TARGET_FOUND"
        TaskScrollTerminationReason.EdgeReached -> "EDGE_REACHED"
        TaskScrollTerminationReason.MaxScrollsReached -> "MAX_SCROLLS_REACHED"
        TaskScrollTerminationReason.MaxDurationReached -> "MAX_DURATION_REACHED"
        TaskScrollTerminationReason.NoPositionChange -> "NO_POSITION_CHANGE"
        TaskScrollTerminationReason.ContainerNotFound -> "CONTAINER_NOT_FOUND"
        TaskScrollTerminationReason.ContainerNotScrollable -> "CONTAINER_NOT_SCROLLABLE"
        TaskScrollTerminationReason.ContainerLost -> "CONTAINER_LOST"
    }
