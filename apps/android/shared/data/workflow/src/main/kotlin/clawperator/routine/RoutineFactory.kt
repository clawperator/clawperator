package clawperator.routine

import clawperator.routine.airconditioner.AirConditionerRunForDurationRoutine
import clawperator.routine.temperature.TemperatureRegulatorCoolRoutine

interface RoutineFactory {

    fun createAirConditionerRunForDurationRoutine(): AirConditionerRunForDurationRoutine

    fun createTemperatureRegulatorCoolRoutine(): TemperatureRegulatorCoolRoutine
}
