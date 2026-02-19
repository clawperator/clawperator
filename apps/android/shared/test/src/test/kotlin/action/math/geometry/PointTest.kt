package action.math.geometry

import kotlin.test.Test

class PointTest {
    @Test
    fun `PointF to and from Json`() {
        val point = PointF(1f, 2f)
        val json = point.exportString
        val newPoint = PointF.fromExportString(json)
        assert(point == newPoint)
    }
}
