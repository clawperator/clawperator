package action.math

import kotlin.math.PI
import kotlin.test.Test
import kotlin.test.assertEquals as assertEqualsKt

internal class MathExtensionsKtTest {
    private val equalsDelta = .001

    private fun assertEquals(
        expected: Double,
        actual: Double,
    ) {
        assertEqualsKt(expected, actual, equalsDelta)
    }

    @Test
    fun `asClampedAngle() near -PI threshold`() {
        val maxAngle = 1.2
        assertEquals(-.1, (-PI + .1f).asClampedAngle(maxAngle))
        assertEquals(-.9, (-PI + .9f).asClampedAngle(maxAngle))
    }

    @Test
    fun `asClampedAngle() near PI threshold`() {
        val maxAngle = 1.2
        assertEquals(.1, (PI - .1f).asClampedAngle(maxAngle))
        assertEquals(.9, (PI - .9f).asClampedAngle(maxAngle))
    }

    @Test
    fun `asClampedAngle() near 0 threshold`() {
        val maxAngle = 1.2
        assertEquals(.1, (.1).asClampedAngle(maxAngle))
        assertEquals(.9, (.9).asClampedAngle(maxAngle))
        assertEquals(1.2, (1.2).asClampedAngle(maxAngle))
        assertEquals(-.1, (-.1).asClampedAngle(1.0))
        assertEquals(-.9, (-.9).asClampedAngle(1.0))
    }

    @Test
    fun `asClampedAngle() outside maxAngle positive`() {
        val maxAngle = 1.0
        assertEquals(maxAngle, (maxAngle).asClampedAngle(maxAngle))
        assertEquals(maxAngle, (PI / 2).asClampedAngle(maxAngle))
        assertEquals(maxAngle, (PI - maxAngle).asClampedAngle(maxAngle))
    }

    @Test
    fun `asClampedAngle() outside maxAngle negative`() {
        val maxAngle = 1.0
        assertEquals(-maxAngle, (-maxAngle).asClampedAngle(maxAngle))
        assertEquals(-maxAngle, (-PI / 2).asClampedAngle(maxAngle))
        assertEquals(-maxAngle, (-PI + maxAngle).asClampedAngle(maxAngle))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `asClampedAngle() requires valid value`() {
        (PI * 2).asClampedAngle(1.0)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `asClampedAngle() requires maxAbsAngle must be positive`() {
        (PI).asClampedAngle(-1.0)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `asClampedAngle() requires maxAbsAngle must be less than half PI`() {
        (PI / 2).asClampedAngle(-1.0)
    }
}
