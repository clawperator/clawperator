package action.displaycutout

import action.math.geometry.PointF
import action.math.geometry.Rect

// @Serializable
data class DisplayCutout(
    val bounds: Rect,
    val visualCenter: PointF,
) {
    constructor(bounds: Rect) : this(bounds, bounds.center)

    val inferredDisplayCutoutType: DisplayCutoutType by lazy {
        bounds.inferDisplayCutoutType()
    }

//    val exportString: String
//        get() = Json.encodeToString(kotlinx.serialization.serializer(), this)
//
//    companion object {
//        fun fromExportString(exportString: String): DisplayCutout {
//            return Json.decodeFromString(kotlinx.serialization.serializer(), exportString)
//        }
//    }
}
