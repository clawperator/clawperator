package clawperator.routine

import action.time.TimeRepository
import clawperator.routine.airconditioner.AirConditionerRunForDurationRoutine
import clawperator.routine.temperature.TemperatureRegulatorCoolRoutine
import clawperator.workflow.WorkflowManager

class RoutineFactoryDefault(
    private val workflowManager: WorkflowManager,
    private val timeRepository: TimeRepository,
) : RoutineFactory {

    override fun createAirConditionerRunForDurationRoutine(): AirConditionerRunForDurationRoutine {
        return AirConditionerRunForDurationRoutine(
            workflowManager = workflowManager,
            timeRepository = timeRepository,
        )
    }

    override fun createTemperatureRegulatorCoolRoutine(): TemperatureRegulatorCoolRoutine {
        return TemperatureRegulatorCoolRoutine(
            workflowManager = workflowManager,
            timeRepository = timeRepository,
        )
    }
}
