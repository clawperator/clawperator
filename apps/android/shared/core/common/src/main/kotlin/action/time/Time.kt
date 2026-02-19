package action.time

import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone

fun getInstant() = Clock.System.now()

fun getCurrentTimeMillis(): Long = getInstant().toEpochMilliseconds()

fun getCurrentTimeZone(): TimeZone = TimeZone.currentSystemDefault()
