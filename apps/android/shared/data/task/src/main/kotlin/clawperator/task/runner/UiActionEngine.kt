package clawperator.task.runner

import action.log.Log
import action.developeroptions.DeveloperOptionsManager
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
                is UiAction.ReadText -> executeReadText(taskScope, action)
                is UiAction.SnapshotUi -> executeSnapshotUi(taskScope, action)
                is UiAction.TakeScreenshot -> executeTakeScreenshot(taskScope, action)
                is UiAction.EnterText -> executeEnterText(taskScope, action)
                is UiAction.Sleep -> executeSleep(taskScope, action)
                is UiAction.DoctorPing -> executeDoctorPing(taskScope, action)
                is UiAction.PressKey -> executePressKey(action)
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

    private suspend fun executeWaitForNode(
        taskScope: TaskScope,
        action: UiAction.WaitForNode,
    ): UiActionStepResult {
        val node =
            taskScope.ui {
                waitForNode(action.matcher, action.retry)
            }

        return UiActionStepResult(
            id = action.id,
            actionType = "wait_for_node",
            data =
                mapOf(
                    "resource_id" to (node.resourceId ?: ""),
                    "label" to node.label,
                ),
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
                    "click_types" to action.clickTypes.toString(),
                ),
        )
    }

    private suspend fun executeScrollAndClick(
        taskScope: TaskScope,
        action: UiAction.ScrollAndClick,
    ): UiActionStepResult {
        taskScope.ui {
            clickAfterScroll(
                target = action.target,
                container = action.container,
                clickTypes = action.clickTypes,
                direction = action.direction,
                maxSwipes = action.maxSwipes,
                distanceRatio = action.distanceRatio,
                settleDelay = action.settleDelayMs.milliseconds,
                scrollRetry = action.scrollRetry,
                clickRetry = action.clickRetry,
                findFirstScrollableChild = action.findFirstScrollableChild,
            )
        }

        return UiActionStepResult(
            id = action.id,
            actionType = "scroll_and_click",
            data =
                mapOf(
                    "max_swipes" to action.maxSwipes.toString(),
                    "direction" to action.direction.toString(),
                    "click_types" to action.clickTypes.toString(),
                ),
        )
    }

    private suspend fun executeReadText(
        taskScope: TaskScope,
        action: UiAction.ReadText,
    ): UiActionStepResult {
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
                }
            }

        return UiActionStepResult(
            id = action.id,
            actionType = "read_text",
            data =
                mapOf(
                    "text" to text,
                    "validator" to (action.validator?.name ?: "none"),
                ),
        )
    }

    private suspend fun executeSnapshotUi(
        taskScope: TaskScope,
        action: UiAction.SnapshotUi,
    ): UiActionStepResult {
        // Snapshot action routes through TaskScope.logUiTree, the same core path used for UI hierarchy dumps.
        val actualFormat = taskScope.logUiTree(retry = action.retry)

        return UiActionStepResult(
            id = action.id,
            actionType = "snapshot_ui",
            data =
                mapOf(
                    "actual_format" to actualFormat.wireValue,
                ),
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
