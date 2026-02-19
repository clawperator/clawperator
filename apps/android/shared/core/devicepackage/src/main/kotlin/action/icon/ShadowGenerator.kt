package action.icon

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF

class ShadowGenerator(
    val iconSize: Int,
) {
    // Percent of actual icon size
    private val halfDistance = 0.5f
    val blurFactor = 0.5f / 48

    // Percent of actual icon size
    private val keyShadowDistance = 1f / 48
    private val keyShadowAlpha = 61

    private val ambientShadowAlpha = 30

    private val canvas = Canvas()
    private val drawPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val blurPaint =
        Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
            maskFilter = BlurMaskFilter(iconSize * blurFactor, BlurMaskFilter.Blur.NORMAL)
        }

    @Synchronized
    fun recreateIcon(icon: Bitmap): Bitmap {
        val offset = IntArray(2)
        val shadow = icon.extractAlpha(blurPaint, offset)
        val result = Bitmap.createBitmap(iconSize, iconSize, Bitmap.Config.ARGB_8888)

        canvas.apply {
            setBitmap(result)

            // Draw ambient shadow
            drawPaint.alpha = ambientShadowAlpha
            drawBitmap(shadow, offset[0].toFloat(), offset[1].toFloat(), drawPaint)

            // Draw key shadow
            drawPaint.alpha = keyShadowAlpha
            drawBitmap(shadow, offset[0].toFloat(), offset[1] + keyShadowDistance * iconSize, drawPaint)

            // Draw the icon
            drawPaint.alpha = 255
            drawBitmap(icon, 0f, 0f, drawPaint)

            setBitmap(null)
        }
        return result
    }

    /**
     * Returns the minimum amount by which an icon with {@param bounds} should be scaled
     * so that the shadows do not get clipped.
     */
    fun getScaleForBounds(bounds: RectF): Float {
        var scale = 1f

        // For top, left & right, we need same space.
        val minSide = Math.min(Math.min(bounds.left, bounds.right), bounds.top)
        if (minSide < blurFactor) {
            scale = (halfDistance - blurFactor) / (halfDistance - minSide)
        }

        val bottomSpace = blurFactor + keyShadowDistance
        if (bounds.bottom < bottomSpace) {
            scale = Math.min(scale, (halfDistance - bottomSpace) / (halfDistance - bounds.bottom))
        }
        return scale
    }
}
