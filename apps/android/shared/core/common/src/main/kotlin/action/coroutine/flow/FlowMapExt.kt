package action.coroutine.flow

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

/**
 * Maps the values of a Flow and only emits when the mapped value changes.
 * This is equivalent to calling map followed by distinctUntilChanged.
 */
@JvmName("mapDistinctExt")
inline fun <T, R> Flow<T>.mapDistinct(crossinline transform: suspend (T) -> R): Flow<R> =
    map { transform(it) }
        .distinctUntilChanged()

/**
 * Maps the values of a Flow and only emits when the mapped value changes.
 * This is equivalent to calling map followed by distinctUntilChanged.
 */
@JvmName("mapDistinct")
inline fun <T, R> mapDistinct(
    flow: Flow<T>,
    crossinline transform: suspend (T) -> R,
): Flow<R> = flow.mapDistinct(transform) 
