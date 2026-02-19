package action.math.geometry

import androidx.compose.runtime.Stable
import androidx.compose.ui.unit.IntOffset
import kotlinx.serialization.Serializable
import kotlin.math.roundToInt

@Stable
@Serializable
data class Rect(
    val left: Float = 0f,
    val top: Float = 0f,
    val right: Float = 0f,
    val bottom: Float = 0f,
) {
    constructor(other: Rect) : this(other.left, other.top, other.right, other.bottom)

    constructor(topLeft: PointF, bottomRight: PointF) : this(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y)

    constructor(position: PointF, width: Float, height: Float) : this(
        position.x,
        position.y,
        position.x + width,
        position.y + height,
    )

    val width: Float
        get() = right - left

    val height: Float
        get() = bottom - top

    val area: Float
        get() = width * height

    val aspectRatio: Float
        get() = width * 1f / height

    val centerX: Float
        get() = (left + right) * .5f

    val centerY: Float
        get() = (top + bottom) * .5f

    val center: PointF by lazy {
        PointF(centerX, centerY)
    }

    val position: PointF
        get() = PointF(left, top)

    val size: PointF
        get() = PointF(width, height)

    val topLeft: PointF
        get() = position

    val topRight: PointF
        get() = PointF(right, top)

    val bottomLeft: PointF
        get() = PointF(left, bottom)

    val bottomRight: PointF
        get() = PointF(right, bottom)

    val offset: IntOffset
        get() =
            IntOffset(
                position.x.roundToInt(),
                position.y.roundToInt(),
            )

    /**
     * Checks if the specified point is inside this rectangle.
     * The point is considered inside if its x-coordinate is between left and right
     * (inclusive) and its y-coordinate is between top and bottom (inclusive).
     *
     * @param point The point to check.
     * @return True if the point is within the rectangle, false otherwise.
     */
    fun contains(point: PointF): Boolean =
        point.x in left..right &&
            point.y >= top &&
            point.y <= bottom

    /**
     * Checks if the specified rectangle is entirely contained within this rectangle.
     * All boundaries of the other rectangle must fall within or exactly on the boundaries
     * of this rectangle.
     *
     * @param other The rectangle to check.
     * @return True if the other rectangle is completely inside this rectangle, false otherwise.
     */
    fun contains(other: Rect): Boolean =
        other.left >= left &&
            other.right <= right &&
            other.top >= top &&
            other.bottom <= bottom

    /**
     * Determines whether this rectangle intersects with the given rectangle.
     * Two rectangles intersect if they share any overlapping area.
     *
     * @param other The rectangle to test for intersection.
     * @return True if the rectangles overlap, false otherwise.
     */
    fun intersects(other: Rect): Boolean =
        !(
            left > other.right ||
                right < other.left ||
                top > other.bottom ||
                bottom < other.top
        )

    fun intersection(other: Rect): Rect? {
        if (!intersects(other)) return null
        return Rect(
            left = maxOf(left, other.left),
            top = maxOf(top, other.top),
            right = minOf(right, other.right),
            bottom = minOf(bottom, other.bottom),
        )
    }

    fun union(other: Rect): Rect =
        Rect(
            left = minOf(left, other.left),
            top = minOf(top, other.top),
            right = maxOf(right, other.right),
            bottom = maxOf(bottom, other.bottom),
        )

    fun inflate(amount: Float): Rect =
        Rect(
            left = left - amount,
            top = top - amount,
            right = right + amount,
            bottom = bottom + amount,
        )

    fun deflate(amount: Float): Rect = inflate(-amount)

    fun offset(
        dx: Float,
        dy: Float,
    ): Rect =
        Rect(
            left = left + dx,
            top = top + dy,
            right = right + dx,
            bottom = bottom + dy,
        )

    fun offset(point: PointF): Rect = offset(point.x, point.y)

    fun scale(
        sx: Float,
        sy: Float,
    ): Rect =
        Rect(
            left = left * sx,
            top = top * sy,
            right = right * sx,
            bottom = bottom * sy,
        )

    fun distanceToPoint(point: PointF): Float {
        // If the point is inside the bounds, distance is 0
        if (contains(point)) return 0f

        // Find the closest point on the bounds
        val closestX = point.x.coerceIn(left, right)
        val closestY = point.y.coerceIn(top, bottom)
        return point.distanceTo(PointF(closestX, closestY))
    }

    override fun toString(): String = "left=$left, top=$top, right=$right, bottom=$bottom"

    companion object {
        val Zero = Rect(0f, 0f, 0f, 0f)
    }
}

fun Rect.normalize(
    width: Float,
    height: Float,
): Rect =
    Rect(
        left = this.left / width,
        right = this.right / width,
        top = this.top / height,
        bottom = this.bottom / height,
    )

// fun Rect.zoomOut(zoomScale: Float) {
//    left -= width * zoomScale
//    right += width * zoomScale
//    top -= height * zoomScale
//    bottom += height * zoomScale
// }
//
// fun Rect.mirrorX(referenceRect: Rect) {
//    val oldRect = Rect(this)
//    left = referenceRect.right - oldRect.right
//    right = referenceRect.right - oldRect.left
// }

val List<Rect>.bounds: Rect
    get() =
        Rect(
            left = map { it.left }.minOf { it },
            top = map { it.top }.minOf { it },
            right = map { it.right }.maxOf { it },
            bottom = map { it.bottom }.maxOf { it },
        )
