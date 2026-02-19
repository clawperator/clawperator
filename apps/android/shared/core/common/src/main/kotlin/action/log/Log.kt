package action.log

import android.os.Build
import timber.log.Timber
import java.util.regex.Pattern

object Log {
    private val tag: String
        get() =
            Throwable()
                .stackTrace
                .first { it.className !in fqcnIgnore }
                .let(::createStackElementTag)

    private val fqcnIgnore =
        listOf(
            Timber::class.java.name,
            Timber.Forest::class.java.name,
            Timber.Tree::class.java.name,
            Timber.DebugTree::class.java.name,
            Log::class.java.name,
        )

    private const val MAX_TAG_LENGTH = 23
    private val ANONYMOUS_CLASS = Pattern.compile("(\\$\\d+)+$")

    private fun createStackElementTag(element: StackTraceElement): String {
        var tag = element.className.substringAfterLast('.')
        val m = ANONYMOUS_CLASS.matcher(tag)
        if (m.find()) {
            tag = m.replaceAll("")
        }
        // Tag length limit was removed in API 26.
        return if (tag.length <= MAX_TAG_LENGTH || Build.VERSION.SDK_INT >= 26) {
            tag
        } else {
            tag.substring(0, MAX_TAG_LENGTH)
        }
    }

    private fun validateMessage(
        message: String?,
        vararg args: Any?,
    ) {
        if (message == null) return
        if (args.isNotEmpty()) {
            message.count { it == '%' }.let { count ->
                if (count > 0) {
                    require(count == args.size) {
                        "Message contains $count placeholders, but ${args.size} arguments were provided.\n  message: $message, args: ${args.joinToString()}"
                    }
                }
            }
        }
    }

    fun e(
        t: Throwable,
    ) {
        Timber.tag(tag)
        Timber.e(t)
    }

    fun e(
        message: String,
        vararg args: Any?,
    ) {
        Timber.tag(tag)
        validateMessage(message, *args)
        Timber.e(message, *args)
    }

    fun e(
        t: Throwable?,
        message: String?,
        vararg args: Any?,
    ) {
        Timber.tag(tag)
        validateMessage(message, *args)
        Timber.e(t, message, *args)
    }

    fun w(
        message: String,
        vararg args: Any?,
    ) {
        Timber.tag(tag)
        validateMessage(message, *args)
        Timber.w(message, *args)
    }

    fun w(
        t: Throwable?,
        message: String?,
        vararg args: Any?,
    ) {
        Timber.tag(tag)
        validateMessage(message, *args)
        Timber.w(t, message, *args)
    }

    fun i(
        message: String,
        vararg args: Any?,
    ) {
        Timber.tag(tag)
        validateMessage(message, *args)
        Timber.i(message, *args)
    }

    fun i(
        t: Throwable?,
        message: String?,
        vararg args: Any?,
    ) {
        Timber.tag(tag)
        validateMessage(message, *args)
        Timber.i(t, message, *args)
    }

    fun d(
        t: Throwable,
    ) {
        Timber.tag(tag)
        Timber.d(t)
    }

    fun d(
        message: String,
        vararg args: Any?,
    ) {
        Timber.tag(tag)
        validateMessage(message, *args)
        Timber.d(message, *args)
    }

    fun d(
        t: Throwable?,
        message: String?,
        vararg args: Any?,
    ) {
        Timber.tag(tag)
        validateMessage(message, *args)
        Timber.d(t, message, *args)
    }

    fun v(
        message: String,
        vararg args: Any?,
    ) {
        Timber.tag(tag)
        validateMessage(message, *args)
        Timber.v(message, *args)
    }

    fun v(
        t: Throwable?,
        message: String?,
        vararg args: Any?,
    ) {
        Timber.tag(tag)
        validateMessage(message, *args)
        Timber.v(t, message, *args)
    }
}
