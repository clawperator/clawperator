package action.devicerefreshrate

import action.appvisibility.AppVisibility
import action.log.Log

import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * For use with devices with multiple refresh rates. There exists no API to be notified of refresh
 * rate changes, so this class polls for an updated refresh rate every
 * [timeBetweenRefreshRateChecks] milliseconds.
 */
class DeviceRefreshRateSystemVariable(
    private val systemRefreshRate: DeviceRefreshRate,
    private val appVisibility: AppVisibility,
    coroutineScope: CoroutineScope,
    private val timeBetweenRefreshRateChecks: Long = TIME_BETWEEN_REFRESH_RATE_CHECKS,
) : DeviceRefreshRate {
    init {
        require(systemRefreshRate.deviceSupportedRefreshRates.size > 1) {
            "Error. This class should only be used if the device has multiple refresh rates."
        }
    }

    companion object {
        const val TIME_BETWEEN_REFRESH_RATE_CHECKS = 334L
    }

    private val logPrefix = "default"

    private var canRequestDelayedPoll: Boolean? = null

    private val _currentRefreshRate = MutableStateFlow(systemRefreshRate.currentRefreshRate.value!!)
    override val currentRefreshRate: StateFlow<Double>
        get() = _currentRefreshRate

    override val deviceSupportedRefreshRates: List<Double>
        get() = systemRefreshRate.deviceSupportedRefreshRates

    private var refreshRateRunnableQueued = false
    private val pollRefreshRateRunnable =
        Runnable {
            updateCurrentRefreshRate()
            if (canRequestDelayedPoll == true) {
                postDelayedPollRequest()
            }
        }

    private val handler = Handler(Looper.getMainLooper())

    private fun postDelayedPollRequest() {
//        Log.v("[$logPrefix] postDelayedPollRequest()")
        refreshRateRunnableQueued = true
        handler.postDelayed(pollRefreshRateRunnable, timeBetweenRefreshRateChecks)
    }

    private fun removeDelayedPollRequest() {
        Log.v("[$logPrefix] removeDelayedPollRequest()")
        handler.removeCallbacks(pollRefreshRateRunnable)
        refreshRateRunnableQueued = false
    }

    private fun updateCurrentRefreshRate(forceUpdate: Boolean = false) {
        val currentRefreshRate = systemRefreshRate.currentRefreshRate.value
        if (currentRefreshRate != _currentRefreshRate.value || forceUpdate) {
            Log.i(
                "[%s] Updating currentRefreshRate: %.1f -> %.1f",
                logPrefix,
                _currentRefreshRate.value,
                currentRefreshRate,
            )
            _currentRefreshRate.value = currentRefreshRate
        }
    }

    private fun updateIsVisible(isVisible: Boolean) {
        canRequestDelayedPoll = isVisible
        if (isVisible) {
            Log.d("[$logPrefix] isVisible = true")
            updateCurrentRefreshRate(forceUpdate = true)
            postDelayedPollRequest()
        } else {
            Log.d("[$logPrefix] isVisible = false")
            removeDelayedPollRequest()
        }
    }

    init {
        coroutineScope.launch {
            appVisibility.isVisible.collect { isVisible ->
                updateIsVisible(isVisible)
            }
        }
        postDelayedPollRequest()
    }
}
