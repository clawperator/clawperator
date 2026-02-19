package action.icon

import action.context.dpToPx
import action.devicepackage.R
import action.livedata.computableLiveData
import action.util.assertNotMainThread
import action.utils.map
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.LauncherActivityInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Rect
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.PaintDrawable
import android.os.Build
import android.util.SparseArray
import androidx.annotation.DrawableRes

class IconResolver(
    context: Context,
) {
    private val resources = context.resources
    private val packageManager: PackageManager by lazy {
        context.packageManager
    }

    private val canvas = Canvas()
    private val oldIconBounds = Rect()

//    private val iconBitmapSize = resources.getDimensionPixelSize(R.dimen.default_icon_size)
    private val iconBitmapSize = context.dpToPx(40f).toInt()
    private val shadowGenerator = ShadowGenerator(iconBitmapSize)
    private val iconNormalizer = IconNormalizer(iconBitmapSize, resources.displayMetrics)
    private val blurFactor = shadowGenerator.blurFactor

    private val fallbackIconInfo =
        computableLiveData {
            processIcon(requireNotNull(context.getDrawable(R.mipmap.ic_launcher_missing)))
        }
    val fallbackIcon = fallbackIconInfo.getLiveData().map { it.first }
    val fallbackIconHighlightColor = fallbackIconInfo.getLiveData().map { it.second }

    fun processIcon(resolveInfo: ResolveInfo) = resolveInfo.loadIcon(packageManager)?.let { processIcon(it) } ?: fallbackIconInfo.computeImmediate()

    fun processIcon(activityInfo: ActivityInfo) = activityInfo.loadIcon(packageManager)?.let { processIcon(it) } ?: fallbackIconInfo.computeImmediate()

    fun processIcon(applicationInfo: ApplicationInfo) = processIcon(packageManager.getApplicationIcon(applicationInfo))

    fun processIcon(launcherActivityInfo: LauncherActivityInfo) = processIcon(launcherActivityInfo.getBadgedIcon(0))

    fun fallbackIconInfoSync() = fallbackIconInfo.computeImmediate()

    fun processIcon(
        @DrawableRes icon: Int,
    ) = processIcon(requireNotNull(resources.getDrawable(icon, null)))

    /**
     * Returns icon with shadow and icon highlight color for given [icon] drawable
     */
    fun processIcon(icon: Drawable): Pair<Drawable, Int> {
        assertNotMainThread()
        val iconBitmap = createIconBitmap(icon, iconNormalizer.getScale(icon))
        val highlightColor = resolveHighlightColor(iconBitmap)
        val iconWithShadow = BitmapDrawable(resources, shadowGenerator.recreateIcon(iconBitmap))
        return Pair(iconWithShadow, highlightColor)
    }

    fun resolveHighlightColor(icon: Bitmap): Int {
        return findDominantColorByHue(icon, 20)
    }

    private fun applyAdaptiveIconTransformation(icon: Drawable) = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && icon is AdaptiveIconDrawable

    fun createIconDrawable(iconByteArray: ByteArray): Drawable {
        assertNotMainThread()
        val icon = BitmapFactory.decodeByteArray(iconByteArray, 0, iconByteArray.size)
        // todo verify icon size
        return BitmapDrawable(resources, icon)
    }

    fun createIconBitmap(
        icon: Drawable,
        scale: Float = iconNormalizer.getScale(icon),
    ): Bitmap {
        synchronized(canvas) {
            var width = iconBitmapSize
            var height = iconBitmapSize

            if (icon is PaintDrawable) {
                icon.intrinsicWidth = width
                icon.intrinsicHeight = height
            } else if (icon is BitmapDrawable) {
                // Ensure the bitmap has a density.
                // Check for null: http://crashes.to/s/5c77d05da4e
                icon.bitmap?.run {
                    if (density == Bitmap.DENSITY_NONE) icon.setTargetDensity(resources.displayMetrics)
                }
            }
            val sourceWidth = icon.intrinsicWidth
            val sourceHeight = icon.intrinsicHeight
            if (sourceWidth > 0 && sourceHeight > 0) {
                // Scale the icon proportionally to the icon dimensions
                val ratio = sourceWidth.toFloat() / sourceHeight
                if (sourceWidth > sourceHeight) {
                    height = (width / ratio).toInt()
                } else if (sourceHeight > sourceWidth) {
                    width = (height * ratio).toInt()
                }
            }

            val left = (iconBitmapSize - width) / 2
            val top = (iconBitmapSize - height) / 2

            oldIconBounds.set(icon.bounds)
            if (applyAdaptiveIconTransformation(icon)) {
                val offset = Math.max((blurFactor * iconBitmapSize).toInt(), Math.min(left, top))
                val size = Math.max(width, height)
                icon.setBounds(offset, offset, size, size)
            } else {
                icon.setBounds(left, top, left + width, top + height)
            }

            val bitmap = Bitmap.createBitmap(iconBitmapSize, iconBitmapSize, Bitmap.Config.ARGB_8888)

            canvas.apply {
                setBitmap(bitmap)
                save()
                scale(scale, scale, (iconBitmapSize / 2).toFloat(), (iconBitmapSize / 2).toFloat())
                icon.draw(this)
                restore()
                setBitmap(null)
            }

            icon.bounds = oldIconBounds

            return bitmap
        }
    }

    /**
     * This picks a dominant color, looking for high-saturation, high-value, repeated hues for
     * [bitmap] to scan and the approximate max number of [samples] to use.
     */
    private fun findDominantColorByHue(
        bitmap: Bitmap,
        samples: Int,
    ): Int {
        val height = bitmap.height
        val width = bitmap.width
        var sampleStride = Math.sqrt((height * width / samples).toDouble()).toInt()
        if (sampleStride < 1) {
            sampleStride = 1
        }

        // This is an out-param, for getting the hsv values for an rgb
        val hsv = FloatArray(3)

        // First get the best hue, by creating a histogram over 360 hue buckets,
        // where each pixel contributes a score weighted by saturation, value, and alpha.
        val hueScoreHistogram = FloatArray(360)
        var highScore = -1f
        var bestHue = -1

        run {
            var y = 0
            while (y < height) {
                var x = 0
                while (x < width) {
                    val argb = bitmap.getPixel(x, y)
                    val alpha = 0xFF and (argb shr 24)
                    if (alpha < 0x80) {
                        // Drop mostly-transparent pixels.
                        x += sampleStride
                        continue
                    }
                    // Remove the alpha channel.
                    val rgb = argb or -0x1000000
                    Color.colorToHSV(rgb, hsv)
                    // Bucket colors by the 360 integer hues.
                    val hue = hsv[0].toInt()
                    if (hue < 0 || hue >= hueScoreHistogram.size) {
                        // Defensively avoid array bounds violations.
                        x += sampleStride
                        continue
                    }
                    val score = hsv[1] * hsv[2]
                    hueScoreHistogram[hue] += score
                    if (hueScoreHistogram[hue] > highScore) {
                        highScore = hueScoreHistogram[hue]
                        bestHue = hue
                    }
                    x += sampleStride
                }
                y += sampleStride
            }
        }

        val rgbScores = SparseArray<Float>()
        var bestColor = -0x1000000
        highScore = -1f
        // Go back over the RGB colors that match the winning hue,
        // creating a histogram of weighted s*v scores, for up to 100*100 [s,v] buckets.
        // The highest-scoring RGB color wins.
        var y = 0
        while (y < height) {
            var x = 0
            while (x < width) {
                val rgb = bitmap.getPixel(x, y) or -0x1000000
                Color.colorToHSV(rgb, hsv)
                val hue = hsv[0].toInt()
                if (hue == bestHue) {
                    val s = hsv[1]
                    val v = hsv[2]
                    val bucket = (s * 100).toInt() + (v * 10000).toInt()
                    // Score by cumulative saturation * value.
                    val score = s * v
                    val oldTotal = rgbScores.get(bucket)
                    val newTotal = if (oldTotal == null) score else oldTotal + score
                    rgbScores.put(bucket, newTotal)
                    if (newTotal > highScore) {
                        highScore = newTotal
                        // All the colors in the winning bucket are very similar. Last in wins.
                        bestColor = rgb
                    }
                }
                x += sampleStride
            }
            y += sampleStride
        }
        return bestColor
    }
}
