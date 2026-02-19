package action.network

import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build

@Suppress("DEPRECATION")
fun ConnectivityManager.getActiveNetworkConnectionState(): NetworkConnectionState =
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getNetworkCapabilities(activeNetwork)?.let {
                when {
                    it.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> NetworkConnectionState.Connected
                    it.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> NetworkConnectionState.Connected
                    else -> NetworkConnectionState.Disconnected
                }
            } ?: NetworkConnectionState.Disconnected
        } else {
            if (activeNetworkInfo?.isConnected == true) {
                NetworkConnectionState.Connected
            } else {
                NetworkConnectionState.Disconnected
            }
        }
    } catch (e: SecurityException) {
        /**
         * Huawei 8.0 devices can raise a SecurityException from a
         * [android.net.NetworkInfo.isConnected()] call. See #1400.
         */
        NetworkConnectionState.Unknown
    }
