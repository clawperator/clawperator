package action.system.model

import action.system.model.ComponentKey.Companion.unflattenFromString
import androidx.compose.runtime.Stable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
@Stable
data class ComponentKey(
    @SerialName("appId")
    val applicationId: ApplicationId,
    @SerialName("cls")
    val className: String,
) {
    constructor(applicationId: ApplicationId) : this(applicationId, "")

    fun flattenToString(): String = "$applicationId/$className"

    fun isApplicationKey() = className.isEmpty()

    companion object {
        fun unflattenFromString(
            string: String,
            allowEmptyClassName: Boolean = false,
        ): ComponentKey {
            val separator = string.indexOf('/')

            if (allowEmptyClassName) {
                require(!(separator < 0 || separator >= string.length)) { "\"$string\" is not valid ComponentKey format" }
            } else {
                require(!(separator < 0 || separator + 1 >= string.length)) { "\"$string\" is not valid ComponentKey format" }
            }

            val applicationId = string.substring(0, separator)
            var className =
                when {
                    allowEmptyClassName && separator == string.length -> String()
                    else -> string.substring(separator + 1)
                }
            if (className.isNotEmpty() && className[0] == '.') {
                className = applicationId + className
            }
            return ComponentKey(applicationId, className)
        }

        fun unflattenFromStringChecked(
            string: String,
            allowEmptyClassName: Boolean = false,
        ): ComponentKey? =
            try {
                unflattenFromString(string, allowEmptyClassName = allowEmptyClassName)
            } catch (ex: IllegalArgumentException) {
                null
            }

        fun applicationKey(appId: String) = ComponentKey(appId)
    }
}

fun String.unflattenComponentKey(allowEmptyClassName: Boolean = false) = requireNotNull(unflattenFromString(this, allowEmptyClassName))
