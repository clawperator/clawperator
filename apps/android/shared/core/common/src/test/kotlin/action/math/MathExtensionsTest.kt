package action.math

import kotlin.math.PI
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MathExtensionsTest {
    @Test
    fun inRangeTest() {
        val r = Random(100)
        val min = 50
        val max = 54
        for (i in 1..100) {
            val result = r.inRange(min, max)
            assertTrue(result in min..max)
        }
    }

    @Test(expected = IllegalArgumentException::class)
    fun inRangeTest_invalid() {
        val r = Random(100)
        r.inRange(2, 1)
    }

    @Test fun inRangeTest_equals() {
        val r = Random(100)
        val result = r.inRange(2, 2)
        assertEquals(2, result)
    }

    @Test fun normalizeRadiansBetween0AndTwoPi() {
        assertEquals(PI + (.141592653589793), (-3.0).normalizeRadiansBetween0AndTwoPi(), .0001)
        assertEquals((PI * 2) - .141592653589793, (-.141592653589793).normalizeRadiansBetween0AndTwoPi(), .0001)
    }

    @Test fun `interpolate Double()`() {
        assertEquals(100.0, interpolate(100.0, 200.0, 0.0), 0.00001)
        assertEquals(125.0, interpolate(100.0, 200.0, 0.25), 0.00001)
        assertEquals(150.0, interpolate(100.0, 200.0, 0.5), 0.00001)
        assertEquals(175.0, interpolate(100.0, 200.0, 0.75), 0.00001)
        assertEquals(200.0, interpolate(100.0, 200.0, 1.0), 0.00001)
    }
}
