package action.resources

import action.annotation.ColorInt
import action.utils.toHexString
import android.content.res.AssetFileDescriptor
import android.graphics.Bitmap
import android.graphics.drawable.Drawable
import androidx.annotation.ArrayRes
import androidx.annotation.AttrRes
import androidx.annotation.BoolRes
import androidx.annotation.ColorRes
import androidx.annotation.DimenRes
import androidx.annotation.DrawableRes
import androidx.annotation.IdRes
import androidx.annotation.RawRes

interface ResourceRepository {
    val deviceHeight: Int

    val deviceWidth: Int

    @ColorInt fun getColor(
        @ColorRes colorRes: Int,
    ): Int

    @ColorInt fun resolveAttributeColor(
        @AttrRes attrRes: Int,
        @ColorInt fallbackColor: Int,
    ): Int

    fun getStringArray(
        @ArrayRes arrayRes: Int,
    ): Array<String>

    fun getIntArray(
        @ArrayRes arrayRes: Int,
    ): IntArray

    fun getBoolean(
        @BoolRes boolRes: Int,
    ): Boolean

    fun getDimenPixelSize(
        @DimenRes dimenRes: Int,
    ): Int

    fun getDimension(
        @DimenRes dimenRes: Int,
    ): Float

    fun getDrawable(
        @DrawableRes drawableRes: Int,
    ): Drawable?

    suspend fun getBitmap(
        @DrawableRes drawableRes: Int,
        @ColorInt color: Int? = null,
    ): Bitmap?

    suspend fun getBitmap(
        @DrawableRes drawableRes: Int,
        reqWidth: Int,
        reqHeight: Int,
        @ColorInt color: Int? = null,
    ): Bitmap?

    fun getResourceEntryName(
        @IdRes resId: Int,
    ): String?

    fun getAssetFileDescriptor(
        @RawRes rawRes: Int,
    ): AssetFileDescriptor

    fun dpToPx(dp: Float): Float

    fun dpToPx(dp: Int): Float

    fun pxToDp(px: Float): Float

    fun pxToDp(px: Int): Float
}

@ExperimentalUnsignedTypes
fun ResourceRepository.getIdAsString(
    @IdRes id: Int?,
): String = id?.let { getResourceEntryName(it) } ?: "$id / ${id?.toHexString()}"
