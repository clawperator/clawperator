package action.network

import kotlinx.coroutines.flow.MutableStateFlow

class NetworkStatePreset(
    networkState: NetworkConnectionState = NetworkConnectionState.Connected,
) : NetworkState {
    override val networkState = MutableStateFlow(networkState)

    fun setState(state: NetworkConnectionState) {
        networkState.value = state
    }

    override val isConnected: Boolean
        get() = networkState.value == NetworkConnectionState.Connected
}
