package action.settings

import action.annotation.VisibleForTesting
import action.coroutine.collectIn
import action.log.Log
import action.preference.MutableObservableValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow

class ObservableValueFlow<T : Any>(
    private val key: String,
    val mutableStateFlow: MutableStateFlow<T>,
    observeAndUpdateFlow: Boolean,
    coroutineScope: CoroutineScope,
    private val updateHandler: ((String, T) -> Unit)? = null,
) : MutableObservableValue<T> /*, Observer<T>*/ {
    private val subscriptions = ArrayList<Subscription>()

    @VisibleForTesting
    val subscriptionCount: Int
        get() = subscriptions.size

//    constructor(liveData: StateFlow<T>, startingValue: T, coroutineScope: CoroutineScope)
//            : this("", liveData, startingValue, coroutineScope, null)

    init {
        require(key.isNotEmpty() || updateHandler == null)
        mutableStateFlow.collectIn(coroutineScope) {
//            collector.emit(it)
            onChanged(it)
        }
//        liveData.observeForever(this)
    }

//    val collector: FlowCollector<T> = FlowCollector<T> { value -> onChanged(value) }

    override fun key(): String = this.key

    override val value: T
        get() = mutableStateFlow.value

    override fun subscribe(
        lifecycleOwner: Any?, // LifecycleOwner?,
        skipFirst: Boolean,
        listener: (T) -> Unit,
    ): action.preference.Subscription {
//        val lifecycle = if (lifecycleOwner != null && lifecycleOwner is LifecycleOwner) {
//            lifecycleOwner.lifecycle
//        } else {
//            null
//        }
        return Subscription(listener, skipFirst).also {
            subscriptions.add(it)
        }
    }

    override fun update(newValue: T) {
        val handler = updateHandler
        if (handler != null) {
            handler(key, newValue)
        } else {
            throw IllegalStateException("the $key preference was created as immutable")
        }
    }

    override fun updateIfNew(newValue: T) {
        if (value != newValue) {
            update(newValue)
        }
    }

    private fun onChanged(value: T) {
        subscriptions
            .toList() // Make a copy to work around concurrent modifications
            .forEach {
                it.notifyChanged(value)
            }
    }

    init {
        /**
         * Only collect/[update] the [MutableObservableValue] if it is being interacted with as a
         * [MutableStateFlow]. Without this check, [update] will never be called so changes won't
         * be saved.
         *
         * If it is instead used as a [MutableObservableValue], [update] is called elsewhere, and
         * this operation is unnecessary and wasteful.
         */
        if (observeAndUpdateFlow) {
            mutableStateFlow.collectIn(coroutineScope) {
                Log.d("ObservableValueFlow onChanged($key -> $it)")
                update(it)
            }
        }
    }

    inner class Subscription(
        val listener: (T) -> Unit,
        val skipFirst: Boolean,
    ) : action.preference.Subscription {
        private var pendingUpdate: T? = null

        // Flow is different to LiveData in that it will always emit the current value, so use this
        // flag to skip the first emission.
        private var skipNext = skipFirst

        init {
//            lifecycle?.addObserver(this)
            if (!skipFirst) {
                listener(value)
            }
        }

        fun notifyChanged(newValue: T) {
            if (skipNext) {
                skipNext = false
                return
            }

//            if (lifecycle == null) {
//                listener(newValue)
//            } else {
//                if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
            listener(newValue)
//                } else {
//                    pendingUpdate = newValue
//                }
//            }
        }

//        @OnLifecycleEvent(Lifecycle.Event.ON_START)
        fun deliverPendingUpdate() {
            val update = pendingUpdate
            if (update != null) {
                listener(update)
            }
        }

//        @OnLifecycleEvent(Lifecycle.Event.ON_DESTROY)
        override fun cancel() {
//            lifecycle?.removeObserver(this)
            subscriptions.remove(this)
        }
    }
}
