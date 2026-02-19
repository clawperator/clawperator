package action.notification

interface NotificationChannelManager {
    fun createChannel(channelId: String): String
}

class NotificationChannelManagerNoOp : NotificationChannelManager {
    override fun createChannel(channelId: String): String = TODO()
}
