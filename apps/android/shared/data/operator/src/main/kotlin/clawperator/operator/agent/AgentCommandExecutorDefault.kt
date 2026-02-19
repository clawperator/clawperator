package clawperator.operator.agent

import action.log.Log
import clawperator.task.runner.TaskEvent
import clawperator.task.runner.TaskResult
import clawperator.task.runner.TaskRunnerManager
import clawperator.task.runner.TaskStatusSink
import clawperator.task.runner.UiActionEngine
import clawperator.task.runner.UiActionExecutionResult
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout

class AgentCommandExecutorDefault(
    private val taskRunnerManager: TaskRunnerManager,
    private val uiActionEngine: UiActionEngine,
) : AgentCommandExecutor {
    companion object {
        private const val TAG = "[Operator-AgentEvent]"
    }

    override suspend fun execute(command: AgentCommand): TaskResult<UiActionExecutionResult> {
        val statusSink = LoggingTaskStatusSink(command.commandId, command.taskId)

        Log.i(
            "$TAG command_start commandId=${command.commandId} taskId=${command.taskId} source=${command.source} timeoutMs=${command.timeoutMs} actionCount=${command.actions.size}",
        )

        val result =
            try {
                withTimeout(command.timeoutMs) {
                    taskRunnerManager.run(statusSink) {
                        uiActionEngine.execute(
                            taskScope = this,
                            plan = command.toPlan(),
                        )
                    }
                }
            } catch (e: TimeoutCancellationException) {
                TaskResult.Failed(
                    reason = "Agent command timed out after ${command.timeoutMs}ms",
                    cause = e,
                )
            }

        when (result) {
            is TaskResult.Success -> {
                Log.i(
                    "$TAG command_success commandId=${command.commandId} taskId=${command.taskId} stepCount=${result.value.stepResults.size}",
                )
            }
            is TaskResult.Failed -> {
                Log.e(
                    result.cause,
                    "$TAG command_failure commandId=${command.commandId} taskId=${command.taskId} reason=${result.reason}",
                )
            }
        }

        return result
    }
}

private class LoggingTaskStatusSink(
    private val commandId: String,
    private val taskId: String,
) : TaskStatusSink {
    companion object {
        private const val TAG = "[Operator-AgentEvent]"
    }

    override fun emit(event: TaskEvent) {
        when (event) {
            is TaskEvent.StageStart -> {
                Log.d("$TAG stage_start commandId=$commandId taskId=$taskId id=${event.id} label=${event.label}")
            }
            is TaskEvent.StageSuccess -> {
                Log.d("$TAG stage_success commandId=$commandId taskId=$taskId id=${event.id} data=${event.data}")
            }
            is TaskEvent.StageFailure -> {
                Log.e(event.throwable, "$TAG stage_failure commandId=$commandId taskId=$taskId id=${event.id} reason=${event.reason}")
            }
            is TaskEvent.RetryScheduled -> {
                Log.d(
                    "$TAG stage_retry commandId=$commandId taskId=$taskId id=${event.stageId} attempt=${event.attempt}/${event.maxAttempts} delayMs=${event.nextDelayMs}",
                )
            }
            is TaskEvent.Log -> {
                Log.d("$TAG stage_log commandId=$commandId taskId=$taskId message=${event.message}")
            }
        }
    }
}
