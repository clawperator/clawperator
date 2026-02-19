package action.math

import action.math.geometry.Rect
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

fun distanceBetweenPoints(
    x1: Double,
    y1: Double,
    x2: Double,
    y2: Double,
): Double = hypot(x1 - x2, y1 - y2)

/**
 * Return a random [Int] between [min] (inclusive) and [max] (inclusive).
 */
fun Random.inRange(
    min: Int,
    max: Int,
): Int {
    require(min <= max)
    return nextInt((max - min) + 1) + min
}

/**
 * Return a random [Float] between [min] (inclusive) and [max] (inclusive).
 */
fun Random.inRange(
    min: Float,
    max: Float,
): Float {
    require(min <= max)
    return nextFloat() * (max - min) + min
}

fun Double.constrain(
    min: Double,
    max: Double,
): Double = max(min, min(max, this))

fun Float.constrain(
    min: Float,
    max: Float,
): Float = max(min, min(max, this))

/**
 * Returns the linear interpolation of `amount` between `start` and `stop`.
 */
fun lerp(
    start: Double,
    stop: Double,
    amount: Double,
): Double = (1.0 - amount) * start + amount * stop

fun lerp(
    start: Float,
    stop: Float,
    amount: Float,
): Float = (1.0f - amount) * start + amount * stop

fun lerpF(
    start: Float,
    stop: Float,
    amount: Float,
): Float = lerp(start, stop, amount)

fun lerp(
    start: Rect,
    stop: Rect,
    amount: Float,
) = Rect(
    left = lerp(start.left, stop.left, amount),
    top = lerp(start.top, stop.top, amount),
    right = lerp(start.right, stop.right, amount),
    bottom = lerp(start.bottom, stop.bottom, amount),
)

fun interpolate(
    x1: Double,
    x2: Double,
    f: Double,
): Double = x1 + (x2 - x1) * f

fun interpolate(
    x1: Float,
    x2: Float,
    f: Float,
): Float = x1 + (x2 - x1) * f

fun interpolate(
    x1: Duration,
    x2: Duration,
    f: Double,
): Duration {
    val x1Ms = x1.inWholeMilliseconds.toDouble()
    val x2Ms = x2.inWholeMilliseconds.toDouble()
    return (x1Ms + (x2Ms - x1Ms) * f).milliseconds
}

fun uninterpolate(
    x1: Float,
    x2: Float,
    v: Float,
): Float {
    if (x2 - x1 == 0f) {
        throw IllegalArgumentException("Can't reverse interpolate with domain size of 0")
    }
    return (v - x1) / (x2 - x1)
}

fun Int.floorEven() = this and 0x01.inv()

fun Int.roundMult4() = this + 2 and 0x03.inv()

fun Float.roundUp(): Float {
    val wholeNumber = roundToInt().toFloat()
    val remainder = this - wholeNumber
    return if (remainder > 0f) {
        wholeNumber + 1f
    } else {
        wholeNumber
    }
}

// divide two integers but round up
// see http://stackoverflow.com/a/7446742/102703
fun Int.divideRoundUp(divisor: Int): Int {
    val sign = (if (this > 0) 1 else -1) * if (divisor > 0) 1 else -1
    return sign * (abs(this) + abs(divisor) - 1) / abs(divisor)
}

fun List<Int>.closestValue(value: Int) = minBy { abs(value - it) }

@Throws(IllegalArgumentException::class)
fun normalizedDot(
    x1: Float,
    y1: Float,
    x2: Float,
    y2: Float,
): Double {
    val length1 = sqrt((x1 * x1 + y1 * y1).toDouble())
    val length2 = sqrt((x2 * x2 + y2 * y2).toDouble())

    if (length1 == 0.0 || length2 == 0.0) {
        throw IllegalArgumentException(
            "length of zero (length1:" + length1 +
                ", length2:" + length2 + ", x1:" + x1 + ", y1:" + y1 + ", x2:" + x2 + ", y2:" + y2 + ")",
        )
    }

    val x1n = x1 / length1
    val y1n = y1 / length1
    val x2n = x2 / length2
    val y2n = y2 / length2

    return (x1n * x2n + y1n * y2n)
}

fun Float.round(decimals: Int): Float {
    var multiplier = 1.0f
    repeat(decimals) { multiplier *= 10 }
    return round(this * multiplier) / multiplier
}

fun Double.round(decimals: Int): Double {
    var multiplier = 1.0
    repeat(decimals) { multiplier *= 10 }
    return round(this * multiplier) / multiplier
}

fun Double.toRadians(): Double = this * PI / 180.0

fun Double.toDegrees(): Double = this * 180.0 / PI

fun Double.normalizeRadiansBetween0AndTwoPi(): Double {
    require(this >= -PI && this <= PI)
    return if (this < 0) {
        PI + (PI - this * -1)
    } else {
        this
    }
}

val gaussianArray = doubleArrayOf(.242, .399, .242)

/**
 * Accepts [this] and returns a clamped result [@FloatRange(from=-maxAbsAngle, to=maxAbsAngle)].
 *
 * [this] is an angle in Radians with a [@FloatRange(from=-PI, to=PI)].
 */
fun Double.asClampedAngle(maxAbsAngle: Double): Double {
    require(this >= -PI && this <= PI)
    require(maxAbsAngle > 0 && maxAbsAngle < (PI / 2))

    val adjusted = normalizeRadiansBetween0AndTwoPi()

    val topLeft = 2 * PI - maxAbsAngle
    val bottomLeft = PI + maxAbsAngle
    val topRight = maxAbsAngle
    val bottomRight = PI - maxAbsAngle

    return if (adjusted in bottomLeft..topLeft) {
        -maxAbsAngle
    } else if (adjusted in topRight..bottomRight) {
        maxAbsAngle
    } else if (adjusted < topRight) {
        this
    } else if (adjusted < PI && adjusted > bottomRight) {
        PI - this
    } else if (adjusted > PI && adjusted < bottomLeft) {
        PI - adjusted
    } else if (adjusted > topLeft) {
        ((PI * 2) - adjusted) * -1f
    } else {
        throw IllegalArgumentException("Unhandled flow")
    }
}

/**
 * Returns the non-negative remainder of x / m.
 *
 * @param x The operand.
 * @param m The modulus.
 */
fun mod(
    x: Double,
    m: Double,
): Double = (x % m + m) % m

/**
 * Wraps the given value into the inclusive-exclusive interval between min and max.
 *
 * @param n   The value to wrap.
 * @param min The minimum.
 * @param max The maximum.
 */
fun wrap(
    n: Double,
    min: Double,
    max: Double,
): Double =
    if (n >= min && n < max) {
        n
    } else {
        mod(
            n - min,
            max - min,
        ) + min
    }

fun <T> List<T>.splitList(numLists: Int): List<List<T>> {
    val numElements = size
    val numElementsPerList = (numElements + numLists - 1) / numLists
    return chunked(numElementsPerList)
}

fun <T> List<T>.splitListInTwo(): Pair<List<T>, List<T>> = splitList(2).let { return Pair(it[0], it[1]) }

fun clamp(
    value: Float,
    min: Float,
    max: Float,
): Float {
    if (value < min) {
        return min
    } else if (value > max) {
        return max
    }
    return value
}

fun clamp(
    value: Double,
    min: Double,
    max: Double,
): Double {
    if (value < min) {
        return min
    } else if (value > max) {
        return max
    }
    return value
}

fun clamp(
    value: Int,
    min: Int,
    max: Int,
): Int {
    if (value < min) {
        return min
    } else if (value > max) {
        return max
    }
    return value
}

fun clamp(
    value: Long,
    min: Long,
    max: Long,
): Long {
    if (value < min) {
        return min
    } else if (value > max) {
        return max
    }
    return value
}

const val AVERAGE_RADIUS_OF_EARTH_KM = 6371.0

fun calculateDistanceInKilometers(
    startLat: Double,
    startLng: Double,
    endLat: Double,
    endLng: Double,
): Int {
    val latDistance = (startLat - endLat).toRadians()
    val lngDistance = (startLng - endLng).toRadians()
    val a = (
        sin(latDistance / 2) * sin(latDistance / 2) +
            (
                cos(startLat.toRadians()) * cos(endLat.toRadians()) *
                    sin(lngDistance / 2) * sin(lngDistance / 2)
            )
    )
    val c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return (AVERAGE_RADIUS_OF_EARTH_KM * c).roundToInt()
}
