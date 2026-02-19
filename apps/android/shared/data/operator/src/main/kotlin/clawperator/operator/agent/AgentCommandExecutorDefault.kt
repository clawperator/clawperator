package clawperator.operator.agent

import action.log.Log
import clawperator.task.runner.TaskEvent
import clawperator.task.runner.TaskResult
import clawperator.task.runner.TaskRunnerManager
import clawperator.task.runner.TaskStatusSink
import clawperator.task.runner.UiActionEngine
import clawperator.task.runner.UiActionExecutionResult
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout

class AgentCommandExecutorDefault(
    private val taskRunnerManager: TaskRunnerManager,
    private val uiActionEngine: UiActionEngine,
) : AgentCommandExecutor {
    // Serialize agent commands to prevent overlapping app transitions and mixed UI snapshots in logcat.
    private val commandExecutionMutex = Mutex()

    companion object {
        private const val TAG = "[Clawperator-Command]"
        /** Message prefix for canonical-envelope build errors (not a Log tag override). */
        private const val CLAWPERATOR_RESULT_TAG = "ClawperatorResult"
    }

    override suspend fun execute(command: AgentCommand): TaskResult<UiActionExecutionResult> {
        if (commandExecutionMutex.isLocked) {
            Log.i(
                "$TAG queued commandId=${command.commandId} taskId=${command.taskId} waiting_for_active_command=true",
            )
        }

        return try {
            // Timeout intentionally includes queue wait + execution time.
            // This bounds end-to-end latency per command under contention.
            withTimeout(command.timeoutMs) {
                commandExecutionMutex.withLock {
                    val statusSink = LoggingTaskStatusSink(command.commandId, command.taskId)

                    Log.i(
                        "$TAG start commandId=${command.commandId} taskId=${command.taskId} source=${command.source} timeoutMs=${command.timeoutMs} actionCount=${command.actions.size}",
                    )

                    val result =
                        taskRunnerManager.run(statusSink) {
                            uiActionEngine.execute(
                                taskScope = this,
                                plan = command.toPlan(),
                            )
                        }

                    when (result) {
                        is TaskResult.Success -> {
                            Log.i(
                                "$TAG success commandId=${command.commandId} taskId=${command.taskId} stepCount=${result.value.stepResults.size}",
                            )
                            try {
                                val canonicalLine = buildCanonicalSuccessLine(
                                    commandId = command.commandId,
                                    taskId = command.taskId,
                                    result = result.value,
                                )
                                // Log full line as single message (action.log.Log uses stack-derived tag, not first arg)
                                Log.i(canonicalLine)
                            } catch (e: Throwable) {
                                Log.e(e, "$CLAWPERATOR_RESULT_TAG buildCanonicalSuccessLine failed commandId=${command.commandId}")
                            }
                        }
                        is TaskResult.Failed -> {
                            Log.e(
                                result.cause,
                                "$TAG failure commandId=${command.commandId} taskId=${command.taskId} reason=${result.reason}",
                            )
                            try {
                                val canonicalLine = buildCanonicalFailureLine(
                                    commandId = command.commandId,
                                    taskId = command.taskId,
                                    reason = result.reason,
                                )
                                Log.i(canonicalLine)
                            } catch (e: Throwable) {
                                Log.e(e, "$CLAWPERATOR_RESULT_TAG buildCanonicalFailureLine failed commandId=${command.commandId}")
                            }
                        }
                    }

                    result
                }
            }
        } catch (e: TimeoutCancellationException) {
            val reason = "Agent command timed out after ${command.timeoutMs}ms"
            try {
                val canonicalLine = buildCanonicalFailureLine(
                    commandId = command.commandId,
                    taskId = command.taskId,
                    reason = reason,
                )
                Log.i(canonicalLine)
            } catch (canonicalError: Throwable) {
                Log.e(canonicalError, "$CLAWPERATOR_RESULT_TAG buildCanonicalFailureLine failed commandId=${command.commandId}")
            }
            TaskResult.Failed(reason = reason, cause = e)
        }
    }
}

private class LoggingTaskStatusSink(
    private val commandId: String,
    private val taskId: String,
) : TaskStatusSink {
    companion object {
        private const val TAG = "[Clawperator-Command]"
    }

    override fun emit(event: TaskEvent) {
        when (event) {
            is TaskEvent.StageStart -> {
                Log.d("$TAG stage-start commandId=$commandId taskId=$taskId id=${event.id} label=${event.label}")
            }
            is TaskEvent.StageSuccess -> {
                Log.d("$TAG stage-success commandId=$commandId taskId=$taskId id=${event.id} data=${event.data}")
            }
            is TaskEvent.StageFailure -> {
                Log.e(event.throwable, "$TAG stage-failure commandId=$commandId taskId=$taskId id=${event.id} reason=${event.reason}")
            }
            is TaskEvent.RetryScheduled -> {
                Log.d(
                    "$TAG stage-retry commandId=$commandId taskId=$taskId id=${event.stageId} attempt=${event.attempt}/${event.maxAttempts} delayMs=${event.nextDelayMs}",
                )
            }
            is TaskEvent.Log -> {
                Log.d("$TAG stage-log commandId=$commandId taskId=$taskId message=${event.message}")
            }
        }
    }
}
