package action.string

import action.time.TimeExtensions
import android.content.Context
import androidx.annotation.StringRes
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Locale

class StringRepositorySystem(
    context: Context,
) : StringRepository() {
    private val resources = context.resources

    private var _dateFormat: Pair<Locale, DateFormat>? = null
    override val dateFormat: DateFormat
        get() = SimpleDateFormat(TimeExtensions.DATE_FORMAT_PATTERN, Locale.US)

    override val useMilitaryTimeFormat: Boolean
        get() = false

    override fun getString(
        @StringRes stringRes: Int,
    ): String = resources.getString(stringRes)

    override fun getString(
        stringRes: Int,
        vararg formatArgs: Any,
    ): String = resources.getString(stringRes, *formatArgs)

    override fun getText(
        @StringRes stringRes: Int,
    ): CharSequence = resources.getText(stringRes)

    override fun getStringArray(arrayRes: Int) = resources.getStringArray(arrayRes).toList()
}
