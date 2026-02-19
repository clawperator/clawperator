package action.network

import kotlinx.coroutines.flow.Flow

interface NetworkState {
    val networkState: Flow<NetworkConnectionState>

    val isConnected: Boolean
}
