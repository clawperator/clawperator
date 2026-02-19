package action.icon

import action.log.Log
import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.Drawable
import android.os.Build.VERSION
import android.os.Build.VERSION_CODES
import android.util.DisplayMetrics
import java.nio.ByteBuffer

class IconNormalizer(
    iconSize: Int,
    displayMetrics: DisplayMetrics,
) {
    private val mMaxSize = iconSize * 2
    private val mBitmap = Bitmap.createBitmap(mMaxSize, mMaxSize, Bitmap.Config.ALPHA_8)
    private val mCanvas = Canvas(mBitmap)

    private val mPaintMaskShape =
        Paint().apply {
            color = Color.RED
            style = Paint.Style.FILL
            xfermode = PorterDuffXfermode(PorterDuff.Mode.XOR)
        }

    private val mPaintMaskShapeOutline =
        Paint().apply {
            strokeWidth = 2 * displayMetrics.density
            style = Paint.Style.STROKE
            color = Color.BLACK
            xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
        }

    private val mPixels = ByteArray(mMaxSize * mMaxSize)

    private val mAdaptiveIconBounds = Rect()
    private var mAdaptiveIconScale = SCALE_NOT_INITIALIZED

    // for each y, stores the position of the leftmost x and the rightmost x
    private val mLeftBorder = FloatArray(mMaxSize)
    private val mRightBorder = FloatArray(mMaxSize)
    private val mBounds = Rect()
    private val mShapePath = Path()
    private val mMatrix = Matrix()

    /**
     * Returns if the shape of the icon is same as the path.
     * For this method to work, the shape path bounds should be in [0,1]x[0,1] bounds.
     */
    private fun isShape(maskPath: Path): Boolean {
        // Condition1:
        // If width and height of the path not close to a square, then the icon shape is
        // not same as the mask shape.
        val iconRatio = mBounds.width().toFloat() / mBounds.height()
        if (Math.abs(iconRatio - 1) > BOUND_RATIO_MARGIN) {
            if (DEBUG) {
                Log.d("Not same as mask shape because width != height. %f", iconRatio)
            }
            return false
        }

        // Condition 2:
        // Actual icon (white) and the fitted shape (e.g., circle)(red) XOR operation
        // should generate transparent image, if the actual icon is equivalent to the shape.

        // Fit the shape within the icon's bounding box
        mMatrix.reset()
        mMatrix.setScale(mBounds.width().toFloat(), mBounds.height().toFloat())
        mMatrix.postTranslate(mBounds.left.toFloat(), mBounds.top.toFloat())
        maskPath.transform(mMatrix, mShapePath)

        // XOR operation
        mCanvas.drawPath(mShapePath, mPaintMaskShape)

        // DST_OUT operation around the mask path outline
        mCanvas.drawPath(mShapePath, mPaintMaskShapeOutline)

        // Check if the result is almost transparent
        return isTransparentBitmap()
    }

    /**
     * Used to determine if certain the bitmap is transparent.
     */
    private fun isTransparentBitmap(): Boolean {
        ByteBuffer.wrap(mPixels).apply {
            rewind()
            mBitmap.copyPixelsToBuffer(this)
        }

        var y = mBounds.top
        // buffer position
        var index = y * mMaxSize
        // buffer shift after every row, width of buffer = mMaxSize
        val rowSizeDiff = mMaxSize - mBounds.right

        var sum = 0
        while (y < mBounds.bottom) {
            index += mBounds.left
            for (x in mBounds.left until mBounds.right) {
                if (mPixels[index].toInt() and 0xFF > MIN_VISIBLE_ALPHA) {
                    sum++
                }
                index++
            }
            index += rowSizeDiff
            y++
        }

        val percentageDiffPixels = sum.toFloat() / (mBounds.width() * mBounds.height())
        return percentageDiffPixels < PIXEL_DIFF_PERCENTAGE_THRESHOLD
    }

    /**
     * Returns the amount by which the {@param d} should be scaled (in both dimensions) so that it
     * matches the design guidelines for a launcher icon.
     *
     * We first calculate the convex hull of the visible portion of the icon.
     * This hull then compared with the bounding rectangle of the hull to find how closely it
     * resembles a circle and a square, by comparing the ratio of the areas. Note that this is not an
     * ideal solution but it gives satisfactory result without affecting the performance.
     *
     * This closeness is used to determine the ratio of hull area to the full icon size.
     * Refer [.MAX_CIRCLE_AREA_FACTOR] and [.MAX_SQUARE_AREA_FACTOR]
     *
     * @param outBounds optional rect to receive the fraction distance from each edge.
     */
    @Synchronized
    @SuppressLint("NewApi")
    fun getScale(
        d: Drawable,
        outBounds: RectF? = null,
        path: Path? = null,
        outMaskShape: BooleanArray? = null,
    ): Float {
        if (VERSION.SDK_INT >= VERSION_CODES.O && d is AdaptiveIconDrawable) {
            if (mAdaptiveIconScale != SCALE_NOT_INITIALIZED) {
                outBounds?.set(mAdaptiveIconBounds)
                return mAdaptiveIconScale
            }
        }
        var width = d.intrinsicWidth
        var height = d.intrinsicHeight
        if (width <= 0 || height <= 0) {
            width = if (width <= 0 || width > mMaxSize) mMaxSize else width
            height = if (height <= 0 || height > mMaxSize) mMaxSize else height
        } else if (width > mMaxSize || height > mMaxSize) {
            val max = Math.max(width, height)
            width = mMaxSize * width / max
            height = mMaxSize * height / max
        }

        mBitmap.eraseColor(Color.TRANSPARENT)
        d.setBounds(0, 0, width, height)
        d.draw(mCanvas)

        ByteBuffer.wrap(mPixels).run {
            rewind()
            mBitmap.copyPixelsToBuffer(this)
        }

        // Overall bounds of the visible icon.
        var topY = -1
        var bottomY = -1
        var leftX = mMaxSize + 1
        var rightX = -1

        // Create border by going through all pixels one row at a time and for each row find
        // the first and the last non-transparent pixel. Set those values to mLeftBorder and
        // mRightBorder and use -1 if there are no visible pixel in the row.

        // buffer position
        var index = 0
        // buffer shift after every row, width of buffer = mMaxSize
        val rowSizeDiff = mMaxSize - width
        // first and last position for any row.
        var firstX: Int
        var lastX: Int

        for (y in 0 until height) {
            lastX = -1
            firstX = -1
            for (x in 0 until width) {
                if ((mPixels[index].toInt() and 0xFF) > MIN_VISIBLE_ALPHA) {
                    if (firstX == -1) {
                        firstX = x
                    }
                    lastX = x
                }
                index++
            }
            index += rowSizeDiff

            mLeftBorder[y] = firstX.toFloat()
            mRightBorder[y] = lastX.toFloat()

            // If there is at least one visible pixel, update the overall bounds.
            if (firstX != -1) {
                bottomY = y
                if (topY == -1) {
                    topY = y
                }

                leftX = Math.min(leftX, firstX)
                rightX = Math.max(rightX, lastX)
            }
        }

        if (topY == -1 || rightX == -1) {
            // No valid pixels found. Do not scale.
            return 1f
        }

        convertToConvexArray(mLeftBorder, 1, topY, bottomY)
        convertToConvexArray(mRightBorder, -1, topY, bottomY)

        // Area of the convex hull
        var area = 0f
        for (y in 0 until height) {
            if (mLeftBorder[y] <= -1) {
                continue
            }
            area += mRightBorder[y] - mLeftBorder[y] + 1
        }

        // Area of the rectangle required to fit the convex hull
        val rectArea = ((bottomY + 1 - topY) * (rightX + 1 - leftX)).toFloat()
        val hullByRect = area / rectArea

        val scaleRequired: Float
        scaleRequired =
            if (hullByRect < CIRCLE_AREA_BY_RECT) {
                MAX_CIRCLE_AREA_FACTOR
            } else {
                MAX_SQUARE_AREA_FACTOR + LINEAR_SCALE_SLOPE * (1 - hullByRect)
            }
        mBounds.left = leftX
        mBounds.right = rightX

        mBounds.top = topY
        mBounds.bottom = bottomY

        outBounds?.set(
            mBounds.left.toFloat() / width,
            mBounds.top.toFloat() / height,
            1 - mBounds.right.toFloat() / width,
            1 - mBounds.bottom.toFloat() / height,
        )

        path?.run {
            if (outMaskShape?.isNotEmpty() == true) {
                outMaskShape[0] = isShape(this)
            }
        }

        val areaScale = area / (width * height)
        // Use sqrt of the final ratio as the images is scaled across both width and height.
        val scale = if (areaScale > scaleRequired) Math.sqrt((scaleRequired / areaScale).toDouble()).toFloat() else 1f
        if (VERSION.SDK_INT >= VERSION_CODES.O &&
            d is AdaptiveIconDrawable &&
            mAdaptiveIconScale == SCALE_NOT_INITIALIZED
        ) {
            mAdaptiveIconScale = scale
            mAdaptiveIconBounds.set(mBounds)
        }
        return scale
    }

    companion object {
        private const val TAG = "IconNormalizer"
        private const val DEBUG = false

        // Ratio of icon visible area to full icon size for a square shaped icon
        private const val MAX_SQUARE_AREA_FACTOR = 375.0f / 576

        // Ratio of icon visible area to full icon size for a circular shaped icon
        private const val MAX_CIRCLE_AREA_FACTOR = 380.0f / 576

        private const val CIRCLE_AREA_BY_RECT = Math.PI.toFloat() / 4

        // Slope used to calculate icon visible area to full icon size for any generic shaped icon.
        private val LINEAR_SCALE_SLOPE = (MAX_CIRCLE_AREA_FACTOR - MAX_SQUARE_AREA_FACTOR) / (1 - CIRCLE_AREA_BY_RECT)

        private const val MIN_VISIBLE_ALPHA = 40

        // Shape detection related constants
        private const val BOUND_RATIO_MARGIN = .05f
        private const val PIXEL_DIFF_PERCENTAGE_THRESHOLD = 0.005f
        private const val SCALE_NOT_INITIALIZED = 0f

        // Ratio of the diameter of an normalized circular icon to the actual icon size.
        val ICON_VISIBLE_AREA_FACTOR = 0.92f

        /**
         * Modifies {@param xCoordinates} to represent a convex border. Fills in all missing values
         * (except on either ends) with appropriate values.
         * @param xCoordinates map of x coordinate per y.
         * @param direction 1 for left border and -1 for right border.
         * @param topY the first Y position (inclusive) with a valid value.
         * @param bottomY the last Y position (inclusive) with a valid value.
         */
        private fun convertToConvexArray(
            xCoordinates: FloatArray,
            direction: Int,
            topY: Int,
            bottomY: Int,
        ) {
            val total = xCoordinates.size
            // The tangent at each pixel.
            val angles = FloatArray(total - 1)

            var last = -1 // Last valid y coordinate which didn't have a missing value

            var lastAngle = Float.MAX_VALUE

            for (i in topY + 1..bottomY) {
                if (xCoordinates[i] <= -1) {
                    continue
                }
                var start: Int

                if (lastAngle == java.lang.Float.MAX_VALUE) {
                    start = topY
                } else {
                    var currentAngle = (xCoordinates[i] - xCoordinates[last]) / (i - last)
                    start = last
                    // If this position creates a concave angle, keep moving up until we find a
                    // position which creates a convex angle.
                    if ((currentAngle - lastAngle) * direction < 0) {
                        while (start > topY) {
                            start--
                            currentAngle = (xCoordinates[i] - xCoordinates[start]) / (i - start)
                            if ((currentAngle - angles[start]) * direction >= 0) {
                                break
                            }
                        }
                    }
                }

                // Reset from last check
                lastAngle = (xCoordinates[i] - xCoordinates[start]) / (i - start)
                // Update all the points from start.
                for (j in start until i) {
                    angles[j] = lastAngle
                    xCoordinates[j] = xCoordinates[start] + lastAngle * (j - start)
                }
                last = i
            }
        }
    }
}
