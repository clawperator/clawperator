package action.network

import action.log.Log
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkRequest
import android.os.Build
import kotlinx.coroutines.flow.MutableStateFlow

class NetworkStateDefault(
    connectivityManager: ConnectivityManager,
) : ConnectivityManager.NetworkCallback(),
    NetworkState {
    override val networkState: MutableStateFlow<NetworkConnectionState> =
        MutableStateFlow(connectivityManager.getActiveNetworkConnectionState())

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            connectivityManager.registerDefaultNetworkCallback(this)
        } else {
            connectivityManager.registerNetworkCallback(NetworkRequest.Builder().build(), this)
        }
    }

    override fun onAvailable(network: Network) {
        setState(NetworkConnectionState.Connected)
    }

    override fun onLost(network: Network) {
        setState(NetworkConnectionState.Disconnected)
    }

    fun setState(state: NetworkConnectionState) {
        if (networkState.value == state) return
        networkState.value = state
        Log.d("Network state changed to \"%s\"", state.asNetworkState())
    }

    override val isConnected: Boolean
        get() = networkState.value == NetworkConnectionState.Connected
}
