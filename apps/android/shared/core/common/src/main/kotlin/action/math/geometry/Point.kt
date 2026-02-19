package action.math.geometry

import androidx.compose.runtime.Stable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.Dp
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Stable
@Serializable
@SerialName("Point")
data class Point(
    val x: Int,
    val y: Int,
) {
    constructor(pair: Pair<Int, Int>) : this(pair.first, pair.second)

    val shortString: String
        get() = "($x,$y)"

    val exportString: String
        get() = Json.encodeToString(kotlinx.serialization.serializer(), this)

    companion object {
        fun fromExportString(exportString: String): PointF = Json.decodeFromString(kotlinx.serialization.serializer(), exportString)
    }
}

@Serializable
@Stable
data class PointF(
    val x: Float,
    val y: Float,
) {
    constructor(offset: Offset) : this(offset.x, offset.y)

    operator fun plus(other: PointF) = PointF(x + other.x, y + other.y)

    operator fun minus(other: PointF) = PointF(x - other.x, y - other.y)

    operator fun times(factor: Float) = PointF(x * factor, y * factor)

    operator fun div(factor: Float) = PointF(x / factor, y / factor)

    fun distanceTo(other: PointF): Float {
        val dx = x - other.x
        val dy = y - other.y
        return kotlin.math.sqrt((dx * dx + dy * dy))
    }

    val isZero: Boolean
        get() = x == 0f && y == 0f

    val exportString: String
        get() = Json.encodeToString(kotlinx.serialization.serializer(), this)

    val offset: Offset
        get() = Offset(x, y)

    companion object {
        val Zero = PointF(0f, 0f)

        fun fromExportString(exportString: String): PointF = Json.decodeFromString(kotlinx.serialization.serializer(), exportString)
    }
}

@Stable
@Serializable
data class PointD(
    val x: Double,
    val y: Double,
) {
    val exportString: String
        get() = Json.encodeToString(kotlinx.serialization.serializer(), this)

    companion object {
        fun fromExportString(exportString: String): PointF = Json.decodeFromString(kotlinx.serialization.serializer(), exportString)
    }
}

@Stable
data class PointDp(
    val x: Dp,
    val y: Dp,
)

val Point.pointF: PointF
    get() = PointF(x.toFloat(), y.toFloat())
val Point.pointD: PointD
    get() = PointD(x.toDouble(), y.toDouble())

val PointF.point: Point
    get() = Point(x.toInt(), y.toInt())
val PointF.pointD: PointD
    get() = PointD(x.toDouble(), y.toDouble())

val PointD.point: Point
    get() = Point(x.toInt(), y.toInt())
val PointD.pointF: PointF
    get() = PointF(x.toFloat(), y.toFloat())
