package action.resources.string

import kotlinx.datetime.Instant

interface DateTimeFormatter {
    fun getLocalizedDate(instant: Instant): String
}
