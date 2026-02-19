package action.displaycutout

import action.math.geometry.Rect

enum class DisplayCutoutType {
    PunchHole,
    Unknown,
}

fun Rect.inferDisplayCutoutType(): DisplayCutoutType {
    val xScale = width.toDouble() / height.toDouble()
    if (xScale > .63f && xScale <= 1.35) {
        return DisplayCutoutType.PunchHole
    }
    return DisplayCutoutType.Unknown
}
