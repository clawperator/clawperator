package action.resource

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * A serializable handle to a resource to make saving resource references in the database easier.
 */
@Serializable
@SerialName("ResHandle")
data class ResourceHandle(
    val data: String,
)
