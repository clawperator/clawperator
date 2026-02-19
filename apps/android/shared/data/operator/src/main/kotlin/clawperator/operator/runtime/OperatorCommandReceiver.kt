package clawperator.operator.runtime

import action.coroutine.CoroutineScopes
import action.log.Log
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.os.Build
import clawperator.accessibilityservice.AccessibilityServiceManager
import clawperator.accessibilityservice.closeNotificationPanel
import clawperator.accessibilityservice.currentAccessibilityService
import clawperator.operator.agent.AgentCommand
import clawperator.operator.agent.AgentCommandExecutor
import clawperator.operator.agent.AgentCommandParser
import clawperator.task.runner.TaskEvent
import clawperator.task.runner.TaskResult
import clawperator.task.runner.TaskStatusSinkChannel
import clawperator.task.runner.UiAction
import clawperator.task.runner.UiSnapshotFormat
import clawperator.workflow.WorkflowManager
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

class OperatorCommandReceiver :
    BroadcastReceiver(),
    KoinComponent {
    companion object {
        const val ACTION_RUN_TASK = "app.clawperator.operator.ACTION_RUN_TASK"
        const val ACTION_LOG_UI = "app.clawperator.operator.ACTION_LOG_UI"
        const val ACTION_AGENT_COMMAND = "app.clawperator.operator.ACTION_AGENT_COMMAND"
        const val EXTRA_AGENT_PAYLOAD = "payload"
        private const val AGENT_SOURCE_OPERATOR = "operator"
    }

    val accessibilityServiceManager: AccessibilityServiceManager by inject()
    val workflowManager: WorkflowManager by inject()
    val coroutineScopes: CoroutineScopes by inject()
    val agentCommandParser: AgentCommandParser by inject()
    val agentCommandExecutor: AgentCommandExecutor by inject()

    override fun onReceive(
        context: Context?,
        intent: Intent?,
    ) {
        val accessibilityService = accessibilityServiceManager.currentAccessibilityService
        if (accessibilityService == null) {
            Log.e("[Operator-Receiver] Accessibility service is not available")
            return
        }

        when (intent?.action) {
            ACTION_RUN_TASK -> {
                // First close the notification panel
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    accessibilityService.closeNotificationPanel()
                }

                coroutineScopes.main.launch {
                    // Create status sink to capture task execution events
                    val statusSink = TaskStatusSinkChannel()

                    // Launch coroutine to log events as they are received
                    statusSink.events
                        .onEach { event ->
                            when (event) {
                                is TaskEvent.StageStart -> {
                                    Log.d("[TaskStatusSink] ⏳ ${event.id}: ${event.label}")
                                }
                                is TaskEvent.StageSuccess -> {
                                    val dataDisplay =
                                        if (event.data.isNotEmpty()) {
                                            " | data=${event.data.entries.joinToString { "${it.key}=${it.value}" }}"
                                        } else {
                                            ""
                                        }
                                    Log.d("[TaskStatusSink] ✅ ${event.id}$dataDisplay")
                                }
                                is TaskEvent.StageFailure -> {
                                    Log.d("[TaskStatusSink] ❌ ${event.id}: ${event.reason}")
                                }
                                is TaskEvent.RetryScheduled -> {
                                    Log.d("[TaskStatusSink] 🔄 ${event.stageId} retry ${event.attempt}/${event.maxAttempts} in ${event.nextDelayMs}ms")
                                }
                                is TaskEvent.Log -> {
                                    Log.d("[TaskStatusSink] 📝 ${event.message}")
                                }
                            }
                        }.launchIn(this)

                    val result =
                        workflowManager
                            .getAirConditionerStatus(statusSink)

                    when (result) {
                        is TaskResult.Success -> Log.d("[Operator-Receiver] Task completed successfully with value: ${result.value}")
                        is TaskResult.Failed -> Log.e("[Operator-Receiver] Task failed: ${result.reason}", result.cause)
                    }
                }
            }
            ACTION_LOG_UI -> {
                coroutineScopes.main.launch {
                    val result = executeLegacyLogUiViaAgent()
                    when (result) {
                        is TaskResult.Success -> Log.d("[Operator-Receiver] UI tree logging completed")
                        is TaskResult.Failed -> Log.e("[Operator-Receiver] Failed to log UI tree: ${result.reason}", result.cause)
                    }
                }
            }
            ACTION_AGENT_COMMAND -> {
                if (!isDebuggableBuild(context)) {
                    Log.e("[Operator-Receiver] ACTION_AGENT_COMMAND is disabled for non-debuggable builds")
                    return
                }
                val payload = intent.getStringExtra(EXTRA_AGENT_PAYLOAD)
                if (payload.isNullOrBlank()) {
                    Log.e("[Operator-Receiver] Missing required agent payload extra: $EXTRA_AGENT_PAYLOAD")
                    return
                }
                coroutineScopes.main.launch {
                    val parseResult = agentCommandParser.parse(payload)
                    parseResult
                        .onSuccess { command ->
                            val result = agentCommandExecutor.execute(command)
                            when (result) {
                                is TaskResult.Success -> {
                                    Log.d(
                                        "[Operator-Receiver] Agent command completed successfully commandId=${command.commandId} taskId=${command.taskId}",
                                    )
                                }
                                is TaskResult.Failed -> {
                                    Log.e(
                                        "[Operator-Receiver] Agent command failed commandId=${command.commandId} taskId=${command.taskId}: ${result.reason}",
                                        result.cause,
                                    )
                                }
                            }
                        }.onFailure { error ->
                            Log.e(error, "[Operator-Receiver] Failed to parse agent command payload")
                        }
                }
            }
        }
    }

    private suspend fun executeLegacyLogUiViaAgent(): TaskResult<*> {
        val command =
            AgentCommand(
                commandId = "debug-log-ui",
                taskId = "debug-log-ui",
                source = AGENT_SOURCE_OPERATOR,
                timeoutMs = 30_000L,
                actions =
                    listOf(
                        UiAction.SnapshotUi(
                            id = "snapshot-ui",
                            format = UiSnapshotFormat.Ascii,
                        ),
                    ),
            )
        return agentCommandExecutor.execute(command)
    }

    private fun isDebuggableBuild(context: Context?): Boolean =
        context
            ?.applicationInfo
            ?.let { info -> (info.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0 }
            ?: false
}
