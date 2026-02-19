package action.time

import action.annotation.VisibleForTesting
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.plus
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Duration.Companion.hours

data class Day
    @VisibleForTesting
    internal constructor(
        val _time: Long? = null,
    ) {
        /**
         * Epoch time.
         */
        val time: Long by lazy {
            require(_time == null || _time > 0)
            _time ?: getCurrentTimeMillis()
        }

        /**
         * A [Calendar] instance for [time].
         */
        val localDateTime: LocalDateTime by lazy {
            val instant = Instant.fromEpochMilliseconds(time)
            instant.toLocalDateTime(timeZone)
        }

        val timeZone: TimeZone
            get() = TimeZone.currentSystemDefault()

        /**
         * Midnight on the day of [time].
         */
        val startOfDay = time.getMidnight()

        /**
         * Midnight the day after [time].
         */
        val endOfDay: Long by lazy {
            startOfDay + 24.hours.inWholeMilliseconds
        }

        fun plusDays(amount: Int): Day {
            val millisecondsToAdd = (amount * 24.hours.inWholeMilliseconds)
            val instant = localDateTime.toInstant(timeZone)
            val newLocalDateTime = instant.plus(millisecondsToAdd, DateTimeUnit.MILLISECOND, timeZone)
            return Day(newLocalDateTime.toEpochMilliseconds())
        }

        val dayOfWeek by lazy {
            localDateTime.dayOfWeek
        }

        /**
         * Create a new [Day] instance for the day before [time].
         */
        fun previousDay() = plusDays(-1)

        /**
         * Create a new [Day] instance for the day after [time].
         */
        fun nextDay() = plusDays(1)

        operator fun inc() = this.nextDay()

        operator fun dec() = this.previousDay()

        /**
         * Compares only the [startOfDay] and [endOfDay] values. Returns true even if the time
         * in the day itself is different between the two items.
         */
        fun isSameDay(other: Day): Boolean = startOfDay == other.startOfDay && endOfDay == other.endOfDay

//    fun isAfterDay(other: Day): Boolean =
//        ChronoUnit.DAYS.between(epochDay, calendar.toLocalDate()) > ChronoUnit.DAYS.between(epochDay, other.calendar.toLocalDate())
//
//    fun isBeforeDay(other: Day): Boolean =
//        ChronoUnit.DAYS.between(epochDay, calendar.toLocalDate()) < ChronoUnit.DAYS.between(epochDay, other.calendar.toLocalDate())

        fun isToday(timeRepository: TimeRepository): Boolean = isSameDay(Day.today(timeRepository))

        fun isEffectivelyToday(
            timeRepository: TimeRepository,
            firstHourOfDay: Int,
        ): Boolean = isSameDay(effectiveToday(timeRepository, firstHourOfDay))

//    fun isTodayOrFutureDay(timeRepository: TimeRepository): Boolean {
//        val today = Day.today(timeRepository)
//        return (isSameDay(today) || isAfterDay(today))
//    }

//    override fun toString(): String {
//        return getDateString()
//    }

        companion object {
            private var todayOverride: Day? = null

            fun today() = todayOverride ?: Day(null)

            fun today(timeRepository: TimeRepository) = todayOverride ?: Day(timeRepository.currentTime)

            fun effectiveToday(
                timeRepository: TimeRepository,
                firstHourOfDay: Int,
            ): Day {
                val today = today(timeRepository)
                return if (firstHourOfDay > today.localDateTime.hour) {
                    today.previousDay()
                } else {
                    today
                }
            }

            fun fromTimestamp(ts: Long) = Day(ts)

            fun effectiveDayFromTimestamp(
                ts: Long,
                firstHourOfDay: Int,
            ): Day {
                val today = fromTimestamp(ts)
                return if (firstHourOfDay > today.localDateTime.hour) {
                    today.previousDay()
                } else {
                    today
                }
            }

            @VisibleForTesting fun setTodayForTest(today: Day?) {
                todayOverride = today
            }

            fun createDayList(
                totalDaysInList: Int,
                lastDay: Day = Day.today(),
            ): List<Day> {
                require(totalDaysInList > 0)
                val days = mutableListOf(lastDay)
                for (i in 0 until totalDaysInList - 1) {
                    days.add(0, days.first().previousDay())
                }
                return ArrayList(days)
            }
        }
    }
