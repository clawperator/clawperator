package action.time

import kotlinx.coroutines.flow.Flow

abstract class TimeRepository {
    abstract val currentTime: Long

    val currentTimeVerified: Long?
        get() =
            if (isUsingAutomaticSystemTime) {
                currentTime
            } else {
                null
            }

    abstract val elapsedRealtime: Long

    abstract val isUsingAutomaticSystemTime: Boolean

    abstract val userChangedSystemTime: Flow<Int>
}
