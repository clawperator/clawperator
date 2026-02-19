package action.resources.string

import action.device.DeviceCountry
import action.time.DateTimeInstant
import action.time.toDateTimeInstant
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone

class DateTimeFormatterDefault(
    private val deviceCountry: DeviceCountry,
) : DateTimeFormatter {
    val isUsCountry: Boolean
        get() = true

    private val currentTimeZone: TimeZone
        get() = TimeZone.currentSystemDefault()
    private val Instant.dateTimeInstant: DateTimeInstant
        get() = this.toDateTimeInstant(currentTimeZone)

    private fun getLocalizedDateUs(dateTimeInstant: DateTimeInstant): String = "${dateTimeInstant.month}/${dateTimeInstant.day}/${dateTimeInstant.year}"

    private fun getLocalizedDateRestOfWorld(dateTimeInstant: DateTimeInstant): String = "${dateTimeInstant.day}/${dateTimeInstant.month}/${dateTimeInstant.year}"

    override fun getLocalizedDate(instant: Instant): String {
        val dateTimeInstant = instant.dateTimeInstant
        return if (isUsCountry) {
            getLocalizedDateUs(dateTimeInstant)
        } else {
            getLocalizedDateRestOfWorld(dateTimeInstant)
        }
    }
}
