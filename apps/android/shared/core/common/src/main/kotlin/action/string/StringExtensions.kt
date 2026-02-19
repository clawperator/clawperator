package action.string

import android.graphics.Typeface
import android.net.Uri
import android.text.Html
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StyleSpan
import android.util.Patterns
import android.webkit.URLUtil
import androidx.core.text.HtmlCompat
import java.net.MalformedURLException
import java.net.URL
import kotlin.math.abs
import kotlin.time.Duration.Companion.seconds

fun String.fmt(vararg args: Any?): String = format(*args)

fun String.toUri(): String = Uri.parse(this).toString()

/**
 * Encodes a string for use as a URL query parameter.
 * Uses URLEncoder with UTF-8 encoding.
 */
fun String.urlEncode(): String {
    if (isEmpty()) return this
    return try {
        java.net.URLEncoder.encode(this, "utf-8")
    } catch (e: java.io.UnsupportedEncodingException) {
        this
    }
}

/**
 * Decodes a URL-encoded string using UTF-8 encoding.
 * This is the inverse operation of [urlEncode].
 */
fun String.urlDecode(): String {
    if (isEmpty()) return this
    return try {
        java.net.URLDecoder.decode(this, "utf-8")
    } catch (e: java.io.UnsupportedEncodingException) {
        this
    }
}

fun Spanned.getStyleSpanCount(spanStyle: Int): Int {
    val styleSpans: Array<StyleSpan> = getSpans(0, length, StyleSpan::class.java)
    return styleSpans.filter { it.style and spanStyle == spanStyle }.size
}

fun CharSequence.asBoldSpan(): SpannableString {
    val spannableString = SpannableString(this)
    if (isBlank()) return spannableString
    spannableString.setSpan(StyleSpan(Typeface.BOLD), 0, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    return spannableString
}

fun CharSequence.toHtmlSpanned(): Spanned = toString().toHtmlSpanned()

fun String.toHtmlSpanned(): Spanned = HtmlCompat.fromHtml(this, HtmlCompat.FROM_HTML_MODE_LEGACY)

fun String.stripHtml(): String =
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
        Html.fromHtml(this, Html.FROM_HTML_MODE_LEGACY).toString()
    } else {
        @Suppress("DEPRECATION")
        Html.fromHtml(this).toString()
    }

fun String.asHtmlSpannableString(): SpannableString =
    SpannableString(
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            Html.fromHtml(this, Html.FROM_HTML_MODE_LEGACY)
        } else {
            @Suppress("DEPRECATION")
            Html.fromHtml(this)
        },
    )

fun String?.isValidUrl(): Boolean {
    if (this == null) return false
    return URLUtil.isNetworkUrl(this) && Patterns.WEB_URL.matcher(this).matches()
}

fun String.asDurationString(): String =
    try {
        (toLong() * 1000).asDurationString()
    } catch (e: NumberFormatException) {
        this
    }

fun Long.asDurationString(): String {
    val seconds = this.seconds.inWholeSeconds
    val absSeconds = abs(seconds)
    val hours = absSeconds / 3600
    val minutes = absSeconds % 3600 / 60
    val positive =
        if (hours == 0L) {
            String.format("%02d:%02d", minutes, absSeconds % 60)
        } else {
            String.format("%d:%02d:%02d", hours, minutes, absSeconds % 60)
        }
    return if (seconds < 0) "-$positive" else positive
}

fun getHtmlATag(
    label: String?,
    url: String?,
): String? = if (url != null) "<a href=\"$url\">$label</a>" else label

fun getHtmlATag(url: String?): String? =
    url?.let {
        try {
            getHtmlATag(URL(it).host.uppercase(), it)
        } catch (e: MalformedURLException) {
            null
        }
    }

/**
 * Returns a string having leading and trailing whitespace removed.
 *
 * Differs from [trim] in that it will return [null] if the resulting
 * string is empty.
 */
fun String.trimEx(): String? = with(trim()) { if (isEmpty()) null else this }

fun String.extractInt(): Int {
    val num = replace("\\D".toRegex(), "")
    // return 0 if no digits found
    return if (num.isEmpty()) 0 else num.toInt()
}

fun String.quote(): String = "\"$this\""

fun String.stripWhitespace(): String =
    StringBuilder()
        .apply {
            toCharArray().forEach {
                if (!it.isWhitespace()) append(it)
            }
        }.toString()

fun String.cleanLlmText(): String =
    this
        .replace("\t", " ")
        .trim()
        .trimEnd('\n', '\r')
