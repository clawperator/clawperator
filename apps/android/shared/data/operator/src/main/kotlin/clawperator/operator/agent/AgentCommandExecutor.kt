package clawperator.operator.agent

import clawperator.task.runner.TaskResult
import clawperator.task.runner.UiActionExecutionResult

interface AgentCommandExecutor {
    suspend fun execute(command: AgentCommand): TaskResult<UiActionExecutionResult>
}
