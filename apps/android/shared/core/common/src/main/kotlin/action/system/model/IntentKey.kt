package action.system.model

import androidx.compose.runtime.Stable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * A wrapper for Android's [Intent]. See also `IntentKeyExt.android.kt`.
 */
@Serializable
@SerialName("IntentKey")
@Stable
data class IntentKey(
    @SerialName("intent") val serializedIntent: String,
)
