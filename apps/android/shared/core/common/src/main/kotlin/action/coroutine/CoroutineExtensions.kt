package action.coroutine

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.FlowCollector
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

val CoroutineScopeDefault: CoroutineScope = CoroutineScope(Dispatchers.Main)

val CoroutineDispatcherDefault: CoroutineDispatcher
    get() = Dispatchers.Main.immediate

fun <T> T.asFlow(): Flow<T> = flowOf(this)

fun <T> Flow<T>.collectIn(
    scope: CoroutineScope,
    collector: FlowCollector<T>,
): Job =
    scope.launch {
        collect(collector)
    }

fun <X, Y> StateFlow<X>.map(
    scope: CoroutineScope,
    transform: (X) -> (Y),
): StateFlow<Y> {
    val mutableStateFlow = MutableStateFlow(transform(value))
    scope.launch {
        this@map.map(transform).collect { newValue ->
            mutableStateFlow.value = newValue
        }
    }
    return mutableStateFlow
}
