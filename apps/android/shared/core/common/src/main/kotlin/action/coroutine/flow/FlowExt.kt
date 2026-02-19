package action.coroutine.flow

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.shareIn

/**
 * Returns a flow that emits consecutive pairs of elements from the original flow.
 *
 * Each emitted pair consists of the previous and current element from the source flow. If the source
 * flow emits fewer than two elements, no pair is emitted.
 *
 * Example:
 * ```
 * flowOf(1, 2, 3).pairwise().collect { println(it) } // Outputs: (1, 2) and (2, 3)
 * ```
 *
 * @param T The type of elements in the flow.
 * @return A flow of pairs where the first element is the previous value and the second is the current value.
 */
fun <T> Flow<T>.pairwise(): Flow<Pair<T, T>> =
    flow {
        var hasPrevious = false
        var previous: T? = null
        collect { value ->
            if (hasPrevious) {
                emit((previous as T) to value)
            } else {
                hasPrevious = true
            }
            previous = value
        }
    }

/**
 * Shares emissions of this Flow as a hot SharedFlow in [scope],
 * using WhileSubscribed() and replaying the last [replay] values.
 */
fun <T> Flow<T>.hotIn(
    scope: CoroutineScope,
    replay: Int = 1,
): SharedFlow<T> =
    shareIn(
        scope = scope,
        started = SharingStarted.Eagerly,
        replay = replay,
    )
