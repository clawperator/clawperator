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
import clawperator.operator.agent.AgentCommandExecutor
import clawperator.operator.agent.AgentCommandParser
import clawperator.task.runner.TaskResult
import kotlinx.coroutines.launch
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

class OperatorCommandReceiver :
    BroadcastReceiver(),
    KoinComponent {
    companion object {
        const val ACTION_AGENT_COMMAND = "app.clawperator.operator.ACTION_AGENT_COMMAND"
        const val EXTRA_AGENT_PAYLOAD = "payload"
    }

    val accessibilityServiceManager: AccessibilityServiceManager by inject()
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
            ACTION_AGENT_COMMAND -> {
                if (!isDebuggableBuild(context)) {
                    Log.e("[Operator-Receiver] ACTION_AGENT_COMMAND is disabled for non-debuggable builds")
                    return
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    accessibilityService.closeNotificationPanel()
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
            else -> {
                Log.d("[Operator-Receiver] Ignoring unsupported action=${intent?.action}")
            }
        }
    }

    private fun isDebuggableBuild(context: Context?): Boolean =
        context
            ?.applicationInfo
            ?.let { info -> (info.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0 }
            ?: false
}
