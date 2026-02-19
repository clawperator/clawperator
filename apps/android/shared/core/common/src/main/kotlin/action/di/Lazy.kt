package action.di

/**
 * Mirror of [dagger.Lazy]. Use this rather than [kotlin.Lazy] for backwards compatibility with
 * [GlobalObjectFactory].
 */
fun interface Lazy<T> {
    /**
     * Return the underlying value, computing the value if necessary. All calls to
     * the same `Lazy` instance will return the same result.
     */
    fun get(): T
}
