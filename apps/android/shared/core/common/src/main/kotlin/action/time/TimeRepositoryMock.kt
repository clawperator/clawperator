package action.time

import kotlinx.coroutines.flow.MutableStateFlow
import kotlin.time.Duration

class TimeRepositoryMock(
    var _currentTime: Long,
    var _elapsedRealtime: Long = _currentTime,
    override var isUsingAutomaticSystemTime: Boolean = true,
) : TimeRepository() {
    constructor() : this(getCurrentTimeMillis())

    constructor(_currentTime: Long) : this(_currentTime, _currentTime)

    override val currentTime
        get() = _currentTime

    override val elapsedRealtime: Long
        get() = _elapsedRealtime

    override val userChangedSystemTime = MutableStateFlow(1)

    /**
     * Advances only the wall clock time (currentTime) without affecting elapsed realtime.
     * Use this to simulate wall clock changes like NTP updates or DST transitions.
     */
    fun advanceCurrentTimeOnly(duration: Duration) {
        _currentTime += duration.inWholeMilliseconds
    }

    /**
     * Advances only the elapsed realtime without affecting wall clock time.
     * Use this to simulate monotonic time progression while keeping wall clock fixed.
     */
    fun advanceElapsedTimeOnly(duration: Duration) {
        _elapsedRealtime += duration.inWholeMilliseconds
    }
}
