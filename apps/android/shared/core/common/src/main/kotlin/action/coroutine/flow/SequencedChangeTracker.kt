package action.coroutine.flow

import action.concurrent.atomic.AtomicLong
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.map

/**
 * Helper class that tracks changes with sequential numbering.
 *
 * This class provides a thread-safe way to emit and track changes, assigning each change a unique
 * sequence number to maintain ordering. It encapsulates the internal state management while
 * exposing a clean public API via [flow] for consuming changes.
 *
 * Can be used as an alternative to [SharedFlow] or [MutableSharedFlow] when you need to track the
 * order of changes.
 *
 * Note: to ensure emissions are never skipped, it is recommended to call [buffered] on the flow.
 *
 * @param T The type of change being tracked
 */
class SequencedChangeTracker<T> {
    /**
     * Internal wrapper that associates a change with its sequence number.
     * This helps track the order of changes and ensures they are processed in the correct sequence.
     */
    private data class ChangeWrapper<T>(
        val sequenceNumber: Long = 0,
        val change: T? = null,
    )

    private val sequenceNumber = AtomicLong(0)
    private val _changes = MutableStateFlow(ChangeWrapper<T>())

    /**
     * Public flow of changes, filtered to only emit non-null changes.
     * Consumers of this flow will receive changes in the order they were emitted.
     */
    val flow: Flow<T> =
        _changes
            .map { it.change }
            .filterNotNull()

    /**
     * Emits a change with an automatically incremented sequence number.
     * This operation is thread-safe due to the use of atomic operations.
     */
    fun emit(change: T) {
        val nextSequence = sequenceNumber.incrementAndGet()
        _changes.value =
            ChangeWrapper(
                sequenceNumber = nextSequence,
                change = change,
            )
    }
} 
