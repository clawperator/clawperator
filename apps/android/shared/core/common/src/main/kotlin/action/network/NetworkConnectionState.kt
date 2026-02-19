package action.network

enum class NetworkConnectionState(
    val state: Int,
) {
    Unknown(-1),
    Disconnected(0),
    Connected(1),
    ;

    fun asNetworkState(): String =
        when (this) {
            Unknown -> "unknown"
            Disconnected -> "disconnected"
            Connected -> "connected"
        }
}
