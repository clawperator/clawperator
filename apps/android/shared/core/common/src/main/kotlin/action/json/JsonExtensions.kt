package action.json

import action.log.Log
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.File
import java.io.FileWriter

/**
 * Helper function to get data from a [JSONObject] that may or may not be present.
 *
 * Returns the value as the required type if present, null if not.
 */
inline fun <reified T : Any> JSONObject.getOpt(name: String): T? = opt(name)?.let { it as T }

/**
 * Helper function to get data from a [JSONObject] that may or may not be present.
 *
 * Returns the value as the required type if present, [default] if not.
 */
inline fun <reified T : Any> JSONObject.getOpt(
    name: String,
    default: T,
): T? = opt(name)?.let { it as T } ?: default

@Suppress("UNCHECKED_CAST")
fun <T> JSONArray.iterate(): Iterable<T> = (0 until length()).asSequence().map { get(it) as T }.asIterable()

fun JSONObject.writeToFile(
    outputFolder: String,
    filename: String,
): String? {
    val fileName = "$outputFolder/$filename"
    try {
        val dir = File(outputFolder)
        if (!dir.exists()) {
            dir.mkdir()
        }

        val file = File(fileName)
        file.createNewFile()

        val writer = FileWriter(file)
        writer.write(toString(2))
        writer.flush()
        writer.close()

        Log.d("Outputted queryUsage to %s", fileName)
        return fileName
    } catch (e: Exception) {
        // This is just for a debugging so a catch-all is fine
        Log.w("Unable to save usage data: %s", e.localizedMessage)
        return null
    }
}

fun JSONObject.getBooleanOpt(name: String): Boolean? =
    try {
        getBoolean(name)
    } catch (ex: JSONException) {
        null
    }

fun JSONObject.getStringSetOpt(name: String): Set<String>? =
    try {
        getString(name).asStringSet()
    } catch (ex: JSONException) {
        null
    }

fun JSONObject.getStringOpt(name: String): String? =
    try {
        getString(name)
    } catch (ex: JSONException) {
        null
    }

fun JSONObject.getLongOpt(name: String): Long? =
    try {
        getLong(name)
    } catch (ex: JSONException) {
        null
    }

fun JSONObject.getDoubleOpt(name: String): Double? =
    try {
        getDouble(name)
    } catch (ex: JSONException) {
        null
    }

fun JSONObject.getValueOpt(name: String): Any? =
    getDoubleOpt(name)
        ?.let {
            // If this number has no fractional value, return null and return as a Long below.
            // Required to ensure Long values are not returned as a Double.
            val fraction = it % 1
            if (fraction == 0.0) {
                null
            } else {
                it
            }
        }
        ?: getLongOpt(name)
        ?: getBooleanOpt(name)
        ?: getStringSetOpt(name)
        ?: getStringOpt(name)

private const val SET_STRING_PREFIX = "setOf("
private const val SET_STRING_SUFFIX = ")"

fun Set<String>.toSetString(): String = "$SET_STRING_PREFIX${toString()}$SET_STRING_SUFFIX"

internal fun String.asStringSet(): Set<String>? =
    if (startsWith(SET_STRING_PREFIX) && endsWith(SET_STRING_SUFFIX)) {
        val sansWrapping = substring(SET_STRING_PREFIX.length + 1, length - SET_STRING_SUFFIX.length - 1)
        if (sansWrapping.isEmpty()) {
            emptySet<String>()
        } else {
            mutableSetOf<String>()
                .apply {
                    val items = sansWrapping.split(", ")
                    items.forEach {
                        add(it)
                    }
                }.let {
                    if (it.size > 0) it else null
                }
        }
    } else {
        null
    }
