package action.preference

interface Subscription {
    fun cancel()
}

class CompositeSubscription : Subscription {
    private var subscriptions = ArrayList<Subscription>()

    fun add(subscription: Subscription) {
        subscriptions.add(subscription)
    }

    fun addAll(vararg subscriptions: Subscription) {
        this.subscriptions.addAll(subscriptions)
    }

    override fun cancel() {
        subscriptions.forEach { it.cancel() }
        subscriptions.clear()
    }
}
