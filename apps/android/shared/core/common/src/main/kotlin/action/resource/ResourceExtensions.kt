package action.resource

import android.content.Context
import android.graphics.drawable.Drawable
import androidx.annotation.RawRes
import androidx.core.content.ContextCompat

fun getResourceUrl(resource: Resource): String? =
    if (resource is Resource.Url) {
        resource.url
    } else {
        null
    }

@get:RawRes
val Resource.rawResId: Int?
    get() = (this as? Resource.RawResId)?.rawRes

fun Resource.DrawableResName.getDrawableResId(context: Context): Int? {
    val drawableName = drawableName
    val type = if (isMipMap) "mipmap" else "drawable"
    val resId = context.resources.getIdentifier(drawableName, type, context.packageName)
    return if (resId != 0) {
        resId
    } else {
        null
    }
}

fun Resource.DrawableResName.getDrawable(context: Context): Drawable? =
    getDrawableResId(context)?.let { resId ->
        ContextCompat.getDrawable(context, resId)
    }
