package action.util

import action.log.Log
import kotlin.reflect.KClass
import kotlin.reflect.full.isSubclassOf
import kotlin.reflect.full.memberProperties

enum class DiffStyle {
    DEFAULT,
    DIFF_LIKE, // Uses + / - style for lists
}

fun <T : Any> dataClassDiffs(
    old: T,
    new: T,
    clazz: KClass<T> = old::class as KClass<T>,
    path: String = "",
    style: DiffStyle = DiffStyle.DEFAULT,
    skipDescentClasses: Set<KClass<*>> = emptySet(),
): List<String>? = dataClassDiffsInternal(old, new, clazz, path, style, 0, skipDescentClasses).ifEmpty { null }

fun <T : Any> logDataClassDiffs(
    previous: T,
    current: T,
    tag: String,
    skipDescentClasses: Set<KClass<*>> = emptySet(),
) {
    val diffs = dataClassDiffs(previous, current, skipDescentClasses = skipDescentClasses)
    if (!diffs.isNullOrEmpty()) {
        Log.d("$tag Changes:")
        diffs.forEach { diff ->
            diff.lines().forEach { line ->
                line.chunked(1800).forEachIndexed { i, chunk ->
                    Log.d("$tag  - $chunk")
                }
//                Log.d("$tag   - $line")
            }
        }
    } else {
        Log.d("$tag - No changes")
    }
}

private fun buildDiffLog(
    indent: String,
    path: String,
    oldValue: Any?,
    newValue: Any?,
): String {
    val threshold = 40
    val oldStr = oldValue.toString()
    val newStr = newValue.toString()
    return if (oldStr.length > threshold || newStr.length > threshold) {
        val maxCharactersIfNull = 800
        val (old, new) =
            if (oldStr == "null") {
                oldStr to "${newStr.take(maxCharactersIfNull)}..."
            } else if (newStr == "null") {
                "${oldStr.take(maxCharactersIfNull)}..." to newStr
            } else {
                oldStr to newStr
            }
        "$indent`$path` changed:\n$indent  from: `$old`\n$indent    to: `$new`"
    } else {
        "$indent`$path` changed from `$oldStr` to `$newStr`"
    }
}

private fun <T : Any> dataClassDiffsInternal(
    old: T,
    new: T,
    clazz: KClass<T> = old::class as KClass<T>,
    path: String = "",
    style: DiffStyle,
    depthLevel: Int = 0,
    skipDescentClasses: Set<KClass<*>> = emptySet(),
): List<String> {
    val diffs = mutableListOf<String>()
    val indent = "  ".repeat(depthLevel)

    for (prop in clazz.memberProperties) {
        val oldValue = runCatching { prop.get(old) }.getOrNull()
        val newValue = runCatching { prop.get(new) }.getOrNull()
        val currentPath = if (path.isEmpty()) prop.name else "$path.${prop.name}"

        if (oldValue == null && newValue == null) continue
        if (oldValue == null || newValue == null) {
            diffs.add(buildDiffLog(indent, currentPath, oldValue, newValue))
            continue
        }

        val oldClass = oldValue::class
        val newClass = newValue::class

        if (oldClass.isData && newClass.isData && skipDescentClasses.none { oldClass.isSubclassOf(it) }) {
            diffs +=
                dataClassDiffsInternal(
                    oldValue,
                    newValue,
                    oldClass as KClass<Any>,
                    currentPath,
                    style,
                    depthLevel + 1,
                    skipDescentClasses,
                )
        } else if (oldValue is List<*> && newValue is List<*>) {
            if (style == DiffStyle.DIFF_LIKE) {
                val oldSet = oldValue.mapIndexed { i, v -> i to v }.toMap()
                val newSet = newValue.mapIndexed { i, v -> i to v }.toMap()
                val allIndices = (oldSet.keys + newSet.keys).sorted()
                for (i in allIndices) {
                    val oldItem = oldSet[i]
                    val newItem = newSet[i]
                    val itemPath = "$currentPath[$i]"
                    when {
                        oldItem == null -> diffs.add("$indent+ $itemPath = $newItem")
                        newItem == null -> diffs.add("$indent- $itemPath = $oldItem")
                        oldItem != newItem -> {
                            val oldItemClass = oldItem?.javaClass?.kotlin
                            val newItemClass = newItem?.javaClass?.kotlin
                            if (oldItemClass?.isData == true && newItemClass?.isData == true && skipDescentClasses.none { oldItemClass.isSubclassOf(it) }) {
                                diffs +=
                                    dataClassDiffsInternal(
                                        oldItem,
                                        newItem,
                                        oldItemClass as KClass<Any>,
                                        itemPath,
                                        style,
                                        depthLevel + 1,
                                        skipDescentClasses,
                                    )
                            } else {
                                diffs.add("$indent- $itemPath = $oldItem")
                                diffs.add("$indent+ $itemPath = $newItem")
                            }
                        }
                    }
                }
            } else {
                val maxIndex = maxOf(oldValue.size, newValue.size)
                for (i in 0 until maxIndex) {
                    val oldItem = oldValue.getOrNull(i)
                    val newItem = newValue.getOrNull(i)
                    val itemPath = "$currentPath[$i]"
                    if (oldItem == null && newItem == null) continue
                    if (oldItem == null || newItem == null || oldItem != newItem) {
                        val oldItemClass = oldItem?.javaClass?.kotlin
                        val newItemClass = newItem?.javaClass?.kotlin
                        if (oldItemClass?.isData == true && newItemClass?.isData == true && skipDescentClasses.none { oldItemClass.isSubclassOf(it) }) {
                            diffs +=
                                dataClassDiffsInternal(
                                    oldItem,
                                    newItem,
                                    oldItemClass as KClass<Any>,
                                    itemPath,
                                    style,
                                    depthLevel + 1,
                                    skipDescentClasses,
                                )
                        } else {
                            diffs.add(buildDiffLog(indent, itemPath, oldItem, newItem))
                        }
                    }
                }
            }
        } else if (oldValue != newValue) {
            diffs.add(buildDiffLog(indent, currentPath, oldValue, newValue))
        }
    }
    return diffs
}
