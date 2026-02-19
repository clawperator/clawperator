package clawperator.workflow

import action.unit.Temperature
import clawperator.task.runner.TaskResult
import clawperator.task.runner.TaskStatusSink
import clawperator.uitree.ToggleState

interface WorkflowManager {
    suspend fun getAmbientTemperature(
        status: TaskStatusSink,
    ): TaskResult<Temperature>

    suspend fun getAirConditionerStatus(
        status: TaskStatusSink,
    ): TaskResult<ToggleState>

    suspend fun setAirConditionerStatus(
        desiredState: ToggleState,
        status: TaskStatusSink,
    ): TaskResult<ToggleState>

    suspend fun toggleGarageDoor(
        status: TaskStatusSink,
    ): TaskResult<Unit>

    suspend fun logUiTree(
        status: TaskStatusSink,
    ): TaskResult<Unit>
}
