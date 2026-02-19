package action.util

import kotlin.contracts.ExperimentalContracts
import kotlin.contracts.contract

fun Map<String, Any?>.joinToString(separator: String = "\n"): String {
    val builder = StringBuilder("")
    keys.forEach { key ->
        builder
            .append(key)
            .append(": ")
            .append(get(key))
            .append(separator)
    }
    return builder.toString()
}

fun <T> Set<T>?.nonEmptyList(): List<T>? = this?.toList().nonEmptyList()

fun <T> List<T>?.nonEmptyList(): List<T>? = if (isNullOrEmpty()) null else this

@OptIn(ExperimentalContracts::class)
fun <T> List<T>?.isNotEmpty(): Boolean {
    contract {
        returns(true) implies (this@isNotEmpty != null)
    }
    return !this.isNullOrEmpty()
}

fun <T, U> Map<T, U>?.nonEmptyMap(): Map<T, U>? = if (isNullOrEmpty()) null else this

fun <T> T.oneOf(list: Collection<T>): Boolean = list.contains(this)

inline fun loopUntil(
    condition: () -> Boolean,
    maxLoops: Int = -1,
    body: () -> Unit,
) {
    var loopCount = 0
    while (!condition() && (maxLoops == -1 || loopCount < maxLoops)) {
        body()
        loopCount++
    }
}
