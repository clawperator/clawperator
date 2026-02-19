package action.resources.string

import action.buildconfig.BuildConfig
import kotlinx.datetime.Instant

class StringRepositoryDefault(
    private val buildConfig: BuildConfig,
    private val dateTimeFormatter: DateTimeFormatter,
) : StringRepository() {
    override fun date(date: Instant): String = dateTimeFormatter.getLocalizedDate(date)

    override val versionName: String
        get() = buildConfig.appVersionName + "(shell)"
}
