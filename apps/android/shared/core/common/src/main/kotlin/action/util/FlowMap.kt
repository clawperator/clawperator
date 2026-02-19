package action.util

import androidx.compose.runtime.Stable
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/**
 * A read-only observable map that provides [Flow]s of its contents.
 */
interface FlowMap<K, V> {
    val mapFlow: Flow<Map<K, V>>
    val keysFlow: Flow<Set<K>>
    val valuesFlow: Flow<List<V>>
    val entriesFlow: Flow<Set<Map.Entry<K, V>>>
    val size: Int

    fun isEmpty(): Boolean

    operator fun get(key: K): V?

    fun containsKey(key: K): Boolean

    fun containsValue(value: V): Boolean

    fun forEach(action: (Map.Entry<K, V>) -> Unit)
}

/**
 * A thread-safe mutable map that provides observable [Flow]s of its contents.
 *
 * This class can be used like a normal [MutableMap], with standard operations like [get], [set], [put], and [remove].
 * Additionally, it provides [Flow] properties that emit updates whenever the map's contents change:
 * - [keysFlow]: Emits the current set of keys
 * - [valuesFlow]: Emits the current collection of values
 * - [mapFlow]: Emits a snapshot of the entire map
 * - [entriesFlow]: Emits a snapshot of the entries
 *
 * The flows will emit new values whenever the map is modified through any mutating operation.
 * All operations are thread-safe.
 */
@Stable
class MutableFlowMap<K, V>(
    vararg pairs: Pair<K, V>,
) : FlowMap<K, V>,
    MutableMap<K, V> {
    private val mutex = Any()
    private val backingMap = mutableMapOf<K, V>()
    private val updateFlow = MutableStateFlow(0L)

    override fun get(key: K): V? = synchronized(mutex) { backingMap[key] }

    override fun put(
        key: K,
        value: V,
    ): V? =
        synchronized(mutex) {
            val previous = backingMap.put(key, value)
            notifyUpdate()
            previous
        }

    /**
     * Puts the value into the map if the key is not already present.
     * Returns the previous value associated with the key, or `null` if the key was not present.
     */
    fun putIfDifferent(
        key: K,
        value: V,
    ): V? =
        synchronized(mutex) {
            val previous = backingMap[key]
            if (previous == null) {
                backingMap[key] = value
                notifyUpdate()
                // Return null since the key was new
                return null
            }
            // Return the existing value if the key already exists
            return previous
        }

    override fun remove(key: K): V? =
        synchronized(mutex) {
            val removed = backingMap.remove(key)
            if (removed != null) notifyUpdate()
            removed
        }

    override fun putAll(from: Map<out K, V>) =
        synchronized(mutex) {
            if (from.isNotEmpty()) {
                backingMap.putAll(from)
                notifyUpdate()
            }
        }

    override fun clear() =
        synchronized(mutex) {
            if (backingMap.isNotEmpty()) {
                backingMap.clear()
                notifyUpdate()
            }
        }

    override fun containsKey(key: K): Boolean = synchronized(mutex) { backingMap.containsKey(key) }

    override fun containsValue(value: V): Boolean = synchronized(mutex) { backingMap.containsValue(value) }

    override val size: Int get() = synchronized(mutex) { backingMap.size }

    override fun isEmpty(): Boolean = synchronized(mutex) { backingMap.isEmpty() }

    override val keys: MutableSet<K> get() = synchronized(mutex) { backingMap.keys.toMutableSet() }
    override val values: MutableCollection<V> get() = synchronized(mutex) { backingMap.values.toMutableList() }
    override val entries: MutableSet<MutableMap.MutableEntry<K, V>> get() = synchronized(mutex) { backingMap.entries.toMutableSet() }

    // Flow properties emit defensive copies
    override val keysFlow: Flow<Set<K>> = updateFlow.map { synchronized(mutex) { backingMap.keys.toSet() } }.distinctUntilChanged()
    override val valuesFlow: Flow<List<V>> = updateFlow.map { synchronized(mutex) { backingMap.values.toList() } }.distinctUntilChanged()
    override val mapFlow: Flow<Map<K, V>> = updateFlow.map { synchronized(mutex) { backingMap.toMap() } }.distinctUntilChanged()
    override val entriesFlow: Flow<Set<Map.Entry<K, V>>> = updateFlow.map { synchronized(mutex) { backingMap.entries.toSet() } }.distinctUntilChanged()

    override fun forEach(action: (Map.Entry<K, V>) -> Unit) = synchronized(mutex) { backingMap.forEach(action) }

    private fun notifyUpdate() {
        updateFlow.update { it + 1 }
    }

    companion object {
        fun <K, V> create(): MutableFlowMap<K, V> = MutableFlowMap()

        fun <K, V> of(vararg pairs: Pair<K, V>): MutableFlowMap<K, V> = MutableFlowMap<K, V>().apply { pairs.forEach { (key, value) -> put(key, value) } }
    }

    init {
        pairs.forEach { (key, value) -> backingMap[key] = value }
    }
}
