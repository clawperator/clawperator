package action.icon

import action.log.Log
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.PaintDrawable
import java.io.ByteArrayOutputStream
import java.io.IOException

fun Drawable.getIconBitmap(iconResolver: IconResolver): Bitmap = if (this is BitmapDrawable) this.bitmap else iconResolver.createIconBitmap(this)

private val bitmapRenderCanvas = Canvas()

fun Drawable.getIconBitmap(size: Int): Bitmap {
    if (this is BitmapDrawable) return bitmap

    synchronized(bitmapRenderCanvas) {
        var width = size
        var height = size

        if (this is PaintDrawable) {
            intrinsicWidth = width
            intrinsicHeight = height
        }
        val sourceWidth = intrinsicWidth
        val sourceHeight = intrinsicHeight
        if (sourceWidth > 0 && sourceHeight > 0) {
            // Scale the icon proportionally to the icon dimensions
            val ratio = sourceWidth.toFloat() / sourceHeight
            if (sourceWidth > sourceHeight) {
                height = (width / ratio).toInt()
            } else if (sourceHeight > sourceWidth) {
                width = (height * ratio).toInt()
            }
        }

        val oldIconBounds = bounds

        val left = (width - sourceWidth) / 2
        val top = (height - sourceHeight) / 2
        setBounds(left, top, left + sourceWidth, top + sourceHeight)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)

        bitmapRenderCanvas.apply {
            setBitmap(bitmap)
            save()
            draw(this)
            restore()
            setBitmap(null)
        }

        bounds = oldIconBounds
        return bitmap
    }
}

/**
 * Compresses the bitmap to a byte array for serialization.
 */
fun Bitmap.flatten(): ByteArray {
    // Try go guesstimate how much space the icon will take when serialized
    // to avoid unnecessary allocations/copies during the write.
    val size = width * height * 4
    val out = ByteArrayOutputStream(size)
    return try {
        compress(Bitmap.CompressFormat.PNG, 100, out)
        out.flush()
        out.close()
        out.toByteArray()
    } catch (e: IOException) {
        Log.w("Could not write bitmap")
        ByteArray(0) { 0 }
    }
}
