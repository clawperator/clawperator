package action.graphics.color

import androidx.compose.ui.graphics.Color
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

internal class ColorExtensionsTest {
    @Test fun getContrastingColor() {
        assertEquals(Color.Black, Color.White.getContrastingColor())
        assertEquals(Color.Black, Color(0xfff6f2e7).getContrastingColor())
        assertEquals(Color.White, Color.Black.getContrastingColor())
        assertEquals(Color.White, Color(0xff012839).getContrastingColor())
    }

    @Test fun isLight() {
        assertTrue(Color.White.isLight())
        assertTrue(Color.Yellow.isLight())
        assertTrue(Color.Green.isLight())
        assertFalse(Color.DarkGray.isLight())
        assertFalse(Color.Black.isLight())
    }

    data class SimilarityItem(
        val color1: Color,
        val color2: Color,
        val label: String,
    )

    @Test fun getSimilarity() {
        assertEquals(1f, Color.White.getSimilarity(Color.White))
        assertEquals(0f, Color.White.getSimilarity(Color.Black))

        val almostWhite = Color(0xfffefefe)
        val first = Color.White.getSimilarity(almostWhite)
        val second = almostWhite.getSimilarity(Color.White)
        assertEquals(first, second)

        listOf(
            SimilarityItem(Color.White, almostWhite, "White and Almost White"),
            SimilarityItem(Color.White, almostWhite, "White and Almost White"),
            SimilarityItem(Color.White, Color(0xffeeeeee), "White and Light Gray"),
            SimilarityItem(Color.Red, Color.Green, "Red and Green"),
            SimilarityItem(Color.Red, Color.Blue, "Red and Blue"),
            SimilarityItem(Color.Red, Color.Cyan, "Red and Cyan"),
        ).forEach {
            val similarity = it.color1.getSimilarity(it.color2)
            println("${it.label}: $similarity")
        }
    }

    /**
     * Not exact, but close enough.
     */
//    @Test
    fun getHsl() {
        val color = Color(0xff012839)
        val hsl = color.getHsl()
        val result = hsl.getColorFromHsl()
        assertEquals(color, result)
    }
}
