package clawperator.workflow

import action.unit.Temperature
import clawperator.task.runner.TaskScope
import clawperator.uitree.ToggleState

interface WorkflowFactory {
    suspend fun getSwitchBotTemperature(taskScope: TaskScope): Temperature

    suspend fun toggleSwitchBotSwitch(taskScope: TaskScope)

    suspend fun getGoogleHomeAirConditionerStatus(taskScope: TaskScope): ToggleState

    suspend fun setGoogleHomeAirConditionerStatus(
        taskScope: TaskScope,
        desiredState: ToggleState,
    ): ToggleState

    suspend fun logUiTree(taskScope: TaskScope)
}
