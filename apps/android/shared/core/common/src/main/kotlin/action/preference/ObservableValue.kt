package action.preference

interface ObservableValue<out T> {
    fun key(): String

    val value: T

    fun subscribe(
        lifecycleOwner: Any? /*LifecycleOwner*/ = null,
        skipFirst: Boolean = true,
        listener: (T) -> Unit,
    ): Subscription
}
