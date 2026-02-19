package action.math.geometry

fun rectFrom(rect: android.graphics.Rect?): Rect? =
    if (rect != null) {
        Rect(
            rect.left.toFloat(),
            rect.top.toFloat(),
            rect.right.toFloat(),
            rect.bottom.toFloat(),
        )
    } else {
        null
    }

// fun Rect.mapMatrix(matrix: Matrix) {
//    RectF().let {
//        it.set(left, top, right, bottom)
//        matrix.mapRect(it)
//        set(it.left, it.top, it.right, it.bottom)
//    }
// }

fun Rect.toAndroidRect(): android.graphics.Rect =
    with(this) {
        android.graphics.Rect(left.toInt(), top.toInt(), right.toInt(), bottom.toInt())
    }

fun android.graphics.Rect.toRect(): Rect =
    with(this) {
        Rect(left.toFloat(), top.toFloat(), right.toFloat(), bottom.toFloat())
    }
