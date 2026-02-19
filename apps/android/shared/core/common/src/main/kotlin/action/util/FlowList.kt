package action.util

import androidx.compose.runtime.Stable
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/**
 * A read-only observable list that provides [Flow]s of its contents.
 */
@Stable
interface FlowList<E> : Iterable<E> {
    val listFlow: Flow<List<E>>
    val sizeFlow: Flow<Int>
    val size: Int
    val isEmpty: Boolean

    /**
     * Returns a snapshot of the current contents of the list.
     * This is equivalent to calling [toList].
     */
    val contents: List<E>

    operator fun get(index: Int): E

    operator fun contains(element: E): Boolean

    fun indexOf(element: E): Int

    fun lastIndexOf(element: E): Int

    fun filter(predicate: (E) -> Boolean): List<E>

    fun indexOfFirst(predicate: (E) -> Boolean): Int

    fun indexOfLast(predicate: (E) -> Boolean): Int

    fun find(predicate: (E) -> Boolean): E?

    fun findLast(predicate: (E) -> Boolean): E?

    fun firstOrNull(): E?

    fun firstOrNull(predicate: (E) -> Boolean): E?

    fun first(): E

    fun first(predicate: (E) -> Boolean): E

    fun lastOrNull(): E?

    fun lastOrNull(predicate: (E) -> Boolean): E?

    fun last(): E

    fun last(predicate: (E) -> Boolean): E

    fun any(predicate: (E) -> Boolean): Boolean

    fun all(predicate: (E) -> Boolean): Boolean

    fun none(predicate: (E) -> Boolean): Boolean

    fun count(predicate: (E) -> Boolean): Int

    fun forEach(action: (E) -> Unit)

    /**
     * Returns a new List containing all elements in their current order.
     */
    fun toList(): List<E>
}

/**
 * A thread-safe mutable list that provides observable [Flow]s of its contents.
 *
 * This class can be used like a normal [MutableList], with standard operations like [get], [add], [remove], and [clear].
 * Additionally, it provides [Flow] properties that emit updates whenever the list's contents change:
 * - [listFlow]: Emits a snapshot of the entire list
 * - [sizeFlow]: Emits the current size of the list
 *
 * The flows will emit new values whenever the list is modified through any mutating operation.
 * All operations are thread-safe.
 */
@Stable
class MutableFlowList<E>(
    vararg elements: E,
) : FlowList<E> {
    private val mutex = Any()
    private val backingList = mutableListOf<E>()
    private val updateFlow = MutableStateFlow(0L)

    override fun iterator(): Iterator<E> = synchronized(mutex) { backingList.toList().iterator() }

    override operator fun get(index: Int): E = synchronized(mutex) { backingList[index] }

    /**
     * Returns a snapshot of the current contents of the list.
     */
    override val contents: List<E>
        get() = synchronized(mutex) { backingList.toList() }

    /**
     * Returns a new List containing all elements in their current order.
     */
    override fun toList(): List<E> = synchronized(mutex) { backingList.toList() }

    fun add(element: E): Boolean =
        synchronized(mutex) {
            backingList.add(element).also { if (it) notifyUpdate() }
        }

    fun add(
        index: Int,
        element: E,
    ) = synchronized(mutex) {
        backingList.add(index, element)
        notifyUpdate()
    }

    fun addAll(elements: Collection<E>): Boolean =
        synchronized(mutex) {
            backingList.addAll(elements).also { if (it) notifyUpdate() }
        }

    fun addAll(
        index: Int,
        elements: Collection<E>,
    ): Boolean =
        synchronized(mutex) {
            backingList.addAll(index, elements).also { if (it) notifyUpdate() }
        }

    fun removeAt(index: Int): E =
        synchronized(mutex) {
            backingList.removeAt(index).also { notifyUpdate() }
        }

    fun remove(element: E): Boolean =
        synchronized(mutex) {
            backingList.remove(element).also { if (it) notifyUpdate() }
        }

    fun removeAll(elements: Collection<E>): Boolean =
        synchronized(mutex) {
            backingList.removeAll(elements).also { if (it) notifyUpdate() }
        }

    fun removeAll(predicate: (E) -> Boolean): Boolean =
        synchronized(mutex) {
            backingList.removeAll(predicate).also { if (it) notifyUpdate() }
        }

    fun clear() =
        synchronized(mutex) {
            if (backingList.isNotEmpty()) {
                backingList.clear()
                notifyUpdate()
            }
        }

    fun set(
        index: Int,
        element: E,
    ): E =
        synchronized(mutex) {
            backingList.set(index, element).also { notifyUpdate() }
        }

    fun setIfDifferent(
        index: Int,
        element: E,
    ): Boolean =
        synchronized(mutex) {
            if (backingList[index] == element) {
                return false
            }
            set(index, element)
            return true
        }

    override operator fun contains(element: E): Boolean = synchronized(mutex) { backingList.contains(element) }

    override fun indexOf(element: E): Int = synchronized(mutex) { backingList.indexOf(element) }

    override fun lastIndexOf(element: E): Int = synchronized(mutex) { backingList.lastIndexOf(element) }

    override fun filter(predicate: (E) -> Boolean): List<E> = synchronized(mutex) { backingList.filter(predicate) }

    override fun indexOfFirst(predicate: (E) -> Boolean): Int = synchronized(mutex) { backingList.indexOfFirst(predicate) }

    override fun indexOfLast(predicate: (E) -> Boolean): Int = synchronized(mutex) { backingList.indexOfLast(predicate) }

    override fun find(predicate: (E) -> Boolean): E? = synchronized(mutex) { backingList.find(predicate) }

    override fun findLast(predicate: (E) -> Boolean): E? = synchronized(mutex) { backingList.findLast(predicate) }

    override fun firstOrNull(): E? = synchronized(mutex) { backingList.firstOrNull() }

    override fun firstOrNull(predicate: (E) -> Boolean): E? = synchronized(mutex) { backingList.firstOrNull(predicate) }

    override fun first(): E = synchronized(mutex) { backingList.first() }

    override fun first(predicate: (E) -> Boolean): E = synchronized(mutex) { backingList.first(predicate) }

    override fun lastOrNull(): E? = synchronized(mutex) { backingList.lastOrNull() }

    override fun lastOrNull(predicate: (E) -> Boolean): E? = synchronized(mutex) { backingList.lastOrNull(predicate) }

    override fun last(): E = synchronized(mutex) { backingList.last() }

    override fun last(predicate: (E) -> Boolean): E = synchronized(mutex) { backingList.last(predicate) }

    override fun any(predicate: (E) -> Boolean): Boolean = synchronized(mutex) { backingList.any(predicate) }

    override fun all(predicate: (E) -> Boolean): Boolean = synchronized(mutex) { backingList.all(predicate) }

    override fun none(predicate: (E) -> Boolean): Boolean = synchronized(mutex) { backingList.none(predicate) }

    override fun count(predicate: (E) -> Boolean): Int = synchronized(mutex) { backingList.count(predicate) }

    override val size: Int get() = synchronized(mutex) { backingList.size }
    override val isEmpty: Boolean get() = synchronized(mutex) { backingList.isEmpty() }

    // Flow properties emit defensive copies
    override val listFlow: Flow<List<E>> = updateFlow.map { synchronized(mutex) { backingList.toList() } }.distinctUntilChanged()
    override val sizeFlow: Flow<Int> = updateFlow.map { synchronized(mutex) { backingList.size } }.distinctUntilChanged()

    override fun forEach(action: (E) -> Unit) = synchronized(mutex) { backingList.forEach(action) }

    private fun notifyUpdate() {
        updateFlow.update { it + 1 }
    }

    companion object {
        fun <E> create(): MutableFlowList<E> = MutableFlowList()

        fun <E> of(vararg elements: E): MutableFlowList<E> = MutableFlowList<E>().apply { addAll(elements.toList()) }
    }

    init {
        addAll(elements.toList())
    }
} 
