package clawperator.trigger

import clawperator.data.trigger.TriggerEvent

interface TriggerManager {
    fun trigger(event: TriggerEvent)
}
