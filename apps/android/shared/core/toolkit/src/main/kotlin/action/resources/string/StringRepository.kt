package action.resources.string

import clawperator.resources.string.Strings
import kotlinx.datetime.Instant

/**
 * Minimal string repository for Clawperator operator.
 * Stripped down to only essential functionality.
 */
abstract class StringRepository : Strings {
    abstract fun date(date: Instant): String
    abstract val versionName: String
}
