package action.resource

import action.log.Log
import android.graphics.drawable.Drawable
import androidx.annotation.DrawableRes
import androidx.annotation.RawRes
import androidx.compose.runtime.Stable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.modules.SerializersModule
import androidx.compose.ui.graphics.Color as ActionColor

/**
 * Note: only specific types of resources are supported for serialization.
 */
@Stable
@Serializable
sealed interface Resource {
    val contentDescription: String?

    val exportString: String

    @Stable
    abstract class ResourceImpl : Resource {
        override val contentDescription: String?
            get() = null

        override val exportString: String
            get() = error("TODO: Add serialization for ${this.javaClass}. This means one of two things:\n1. A resource that intentionally doesn't have serialization is attempting to be serialized.\n2. A resource that should be serialized has yet to have serialization supported implemented.")
    }

    @Stable
    data class RawResId(
        @RawRes val rawRes: Int,
    ) : ResourceImpl()

    @Stable
    data class DrawableResId(
        @DrawableRes val drawableRes: Int,
    ) : ResourceImpl()

    /**
     * Use this as opposed to [DrawableResId] when the drawable name is to be saved between
     * sessions. Example, if the drawable name is to be saved for an app icon.
     *
     * Otherwise, use [DrawableResId] for most cases.
     */
    @Stable
    @Serializable
    @SerialName("ResDrawableResName")
    data class DrawableResName(
        @SerialName("name")
        val drawableName: String,
        @SerialName("mip")
        val isMipMap: Boolean = false,
    ) : ResourceImpl() {
        override val exportString: String
            get() = Json.encodeToString(kotlinx.serialization.serializer(), this)
    }

    @Stable
    data class DrawableHolder(
        val drawable: Drawable,
    ) : ResourceImpl()

    @Stable
    @Serializable
    @SerialName("ResUrl")
    data class Url(
        val url: String,
    ) : ResourceImpl() {
        override val exportString: String
            get() = Json.encodeToString(kotlinx.serialization.serializer(), this)
    }

    @Stable
    data class Color(
        private val colorWrapper: ColorWrapper,
    ) : ResourceImpl() {
        constructor(color: ActionColor) : this(ColorWrapper(color.value))

        val color: ActionColor by lazy {
            ActionColor(colorWrapper.color)
        }
    }

    @Stable
    data class FileUri(
        val fileUri: String,
    ) : ResourceImpl()

    companion object {
        val Json =
            Json {
                useArrayPolymorphism = true
                serializersModule =
                    SerializersModule {
                        polymorphic(
                            Resource::class,
                            DrawableResName::class,
                            DrawableResName.serializer(),
                        )
                        polymorphic(
                            Resource::class,
                            Url::class,
                            Url.serializer(),
                        )
                    }
            }

        fun fromExportString(exportString: String): Resource {
            try {
                // This is obviously terrible code, but it works for now.
                return try {
                    Json.decodeFromString<Url>(exportString)
                } catch (e: Exception) {
                    try {
                        Json.decodeFromString<DrawableResName>(exportString)
                    } catch (e: Exception) {
                        throw SerializationException("Unable to parse Resource from: $exportString", e)
                    }
                }
            } catch (ex: SerializationException) {
                Log.e("[Resource] Failed to parse Resource from exportString: $exportString", ex)
                throw ex
            }
        }

        fun from(model: Any): Resource {
            return when (model) {
                is String -> {
                    if (model.startsWith("http")) {
                        return Url(model)
                    } else {
                        throw IllegalArgumentException("Unsupported model: $model")
                    }
                }

                else -> {
                    throw IllegalArgumentException("Unsupported model: $model")
                }
            }
        }

        val Preset: Resource = DrawableResId(-1)
    }
}
