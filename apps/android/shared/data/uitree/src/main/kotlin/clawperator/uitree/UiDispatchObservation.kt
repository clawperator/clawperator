package clawperator.uitree

import kotlin.coroutines.AbstractCoroutineContextElement
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.coroutineContext

/** Records the actual platform attempt without performing another action. */
class UiDispatchObservation(
    private val onRecord: (Any?, String, Boolean) -> Unit,
) : AbstractCoroutineContextElement(Key) {
    companion object Key : CoroutineContext.Key<UiDispatchObservation>
    private var target: Any? = null
    private var method = "none"
    fun record(target: Any?, method: String, accepted: Boolean) {
        this.target = target
        this.method = method
        onRecord(target, method, accepted)
    }
    fun accepted(accepted: Boolean) = onRecord(target, method, accepted)
}

internal suspend fun observeDispatch(target: Any?, method: String, accepted: Boolean) {
    coroutineContext[UiDispatchObservation]?.record(target, method, accepted)
}
