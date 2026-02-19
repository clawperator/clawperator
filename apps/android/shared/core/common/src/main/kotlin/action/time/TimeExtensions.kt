package action.time

import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.toLocalDateTime
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

fun Long.getMidnight(): Long {
    val timeZone = TimeZone.currentSystemDefault()
    val instant = Instant.fromEpochMilliseconds(this)
    val localDate = instant.toLocalDateTime(timeZone)
    val midnight = localDate.date.atStartOfDayIn(timeZone)
    return midnight.toEpochMilliseconds()
}

fun Instant.toDateTimeInstant(timeZone: TimeZone = getCurrentTimeZone()): DateTimeInstant =
    toLocalDateTime(timeZone).let {
        DateTimeInstant(
            year = it.year,
            month = it.monthNumber,
            day = it.dayOfMonth,
            hour = it.hour,
            minute = it.minute,
            second = it.second,
        )
    }

class TimeExtensions {
    companion object {
        const val DATE_FORMAT_PATTERN = "EEE, MMM d"
        const val ONE_HOUR_IN_MILLIS = 60 * 60 * 1000
        const val TWENTY_FOUR_HOURS_IN_MILLIS = 24 * ONE_HOUR_IN_MILLIS

        val dateTimeFormat = SimpleDateFormat("dd-MMM-yyyy HH:mm:ss", Locale.US)
        val dateFormat = SimpleDateFormat(DATE_FORMAT_PATTERN, Locale.US)
        val militaryTimeFormat = SimpleDateFormat("H:mm", Locale.US)
        val amPmTimeFormat = SimpleDateFormat("h:mma", Locale.US)
    }
}

fun Long.getTimeUsedDebug(): String {
    val h = (this / 1000 / 3600)
    val m = (this / 1000 / 60 % 60)
    val s = (this / 1000 % 60)
    return when {
        h == 1L && m == 0L -> "$h hour"
        h > 0 && m == 0L -> "$h hours"
        h > 0 -> "$h hrs, $m mins"
        m > 0 -> "$m minutes"
        s > 0 -> "$s seconds"
        else -> "0 seconds"
    }
}

fun Long.getTimeUsedDaysDebug(): String {
    val d = (this / 1000 / (60 * 60 * 24))
    val h = (this / 1000 / 3600 % 24)
    val m = (this / 1000 / 60 % 60)
    val s = (this / 1000 % 60)
    return when {
        d == 1L && h == 0L -> "$d day"
        d > 0 && h == 0L -> "$d days"
        d == 1L -> "$d day, $h hrs"
        d > 0 -> "$d days, $h hrs"
        h == 1L && m == 0L -> "$h hour"
        h == 1L && m == 1L -> "$h hour, 1 min"
        h == 1L -> "$h hour, $m mins"
        h > 0 && m == 0L -> "$h hours"
        h > 0 -> "$h hrs, $m mins"
        m > 0 -> "$m minutes"
        s > 0 -> "$s seconds"
        else -> "0 seconds"
    }
}

fun Long.getDateTimeString(): String = TimeExtensions.dateTimeFormat.format(Date(this))
fun Long.getDateString(): String = TimeExtensions.dateFormat.format(Date(this))
fun Day.getDateString(): String = time.getDateString()
fun Day.dayOfWeek(): Int = localDateTime.dayOfWeek.isoDayNumber
fun Long.toExactTime(day: Day? = null): Long = (day ?: Day.today()).startOfDay + this
