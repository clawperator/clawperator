package action.json

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.JsonPrimitive

fun <T : Any> JsonObjectBuilder.putValue(
    key: String,
    value: T,
) {
    when (value) {
        is String -> put(key, JsonPrimitive(value))
        is Boolean -> put(key, JsonPrimitive(value))
        is Int -> put(key, JsonPrimitive(value))
        is Long -> put(key, JsonPrimitive(value))
        is Float -> put(key, JsonPrimitive(value))
        is Double -> put(key, JsonPrimitive(value))
        is Set<*> -> {
            value.forEach {
                require(it is String)
            }
            @Suppress("UNCHECKED_CAST")
            put(key, JsonArray((value as Set<String>).map { JsonPrimitive(it) }))
        }
        else -> {
            throw UnsupportedOperationException("Type ${value::class.simpleName} is unsupported")
        }
    }
}
