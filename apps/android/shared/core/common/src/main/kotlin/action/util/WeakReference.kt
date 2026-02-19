package action.util

import java.lang.ref.WeakReference as JvmWeakReference

class WeakReference<T>(
    value: T,
) {
    private val jvmWeakReference = JvmWeakReference(value)

    fun get(): T? = jvmWeakReference.get()

    fun clear() = jvmWeakReference.clear()
}
