package action.string

import kotlin.test.Test
import kotlin.test.assertEquals

class StringExtensionsKtTest {
    //    private fun time(hours: Int = 0, minutes: Int = 0, seconds: Int = 0): Long =
//        (ofHours(hours.toLong()) + ofMinutes(minutes.toLong()) + ofSeconds(seconds.toLong())).toMillis()
//
//    @Test fun `asDurationString() 0_00_00`() {
//        assertEquals("00:00", 0L.asDurationString())
//    }
//
//    @Test fun `asDurationString() 0_00_02`() {
//        assertEquals("00:02", time( 0, 0, 2).asDurationString())
//    }
//
//    @Test fun `asDurationString() 0_01_32`() {
//        assertEquals("01:32", time(0, 1, 32).asDurationString())
//    }
//
//    @Test fun `asDurationString() 1_01_32`() {
//        assertEquals("1:01:32", time(1, 1, 32).asDurationString())
//    }
//
//    @Test fun `asDurationStringString() Long as String`() {
//        assertEquals("01:07", "67".asDurationString())
//    }

//    @Test fun `asDurationStringString() duration already a string`() {
//        assertEquals("01:07", "01:07".asDurationString())
//    }

    @Test
    fun `test no arguments`() {
        assertEquals("Hello World", "Hello World".fmt())
    }

    @Test
    fun `test single argument`() {
        assertEquals("Hello Alice", "Hello %s".fmt("Alice"))
    }

    @Test
    fun `test multiple arguments`() {
        assertEquals("Alice and Bob", "%s and %s".fmt("Alice", "Bob"))
    }

    @Test
    fun `test integer argument`() {
        assertEquals("Age: 30", "Age: %d".fmt(30))
    }

    @Test
    fun `test float argument`() {
        assertEquals("Price: 10.5", "Price: %.1f".fmt(10.5))
    }

    @Test
    fun `test null argument`() {
        assertEquals("Value: null", "Value: %s".fmt(null))
    }

    @Test
    fun `test argument order`() {
        assertEquals("Bob and Alice", "%2\$s and %1\$s".fmt("Alice", "Bob"))
    }

    @Test
    fun `test excess arguments`() {
        assertEquals("Hello Alice", "Hello %s".fmt("Alice", "Bob"))
    }

    @Test
    fun `test mixed argument types`() {
        assertEquals("Alice, 30, 10.5", "%s, %d, %.1f".fmt("Alice", 30, 10.5))
    }

    @Test fun stripWhiteSpaceTest() {
        listOf(
            "Google_Pixel 2" to "Google_Pixel2",
            "Test Manufacturer" to "TestManufacturer",
            " a b b d e f \n g h i " to "abbdefghi",
            " @#S D*# TN G SDF \$%" to "@#SD*#TNGSDF\$%",
        ).forEach {
            assertEquals(it.second, it.first.stripWhitespace())
        }
    }

    @Test
    fun `removes leading and trailing spaces`() {
        assertEquals("Hello", "   Hello   ".cleanLlmText())
    }

    @Test
    fun `removes leading and trailing tabs`() {
        assertEquals("Hello", "\tHello\t".cleanLlmText())
    }

    @Test
    fun `normalizes internal tabs to spaces`() {
        assertEquals("Hello World", "Hello\tWorld".cleanLlmText())
    }

    @Test
    fun `removes trailing newline`() {
        assertEquals("Hello", "Hello\n".cleanLlmText())
    }

    @Test
    fun `removes trailing carriage return`() {
        assertEquals("Hello", "Hello\r".cleanLlmText())
    }

    @Test
    fun `removes multiple trailing newlines and carriage returns`() {
        assertEquals("Hello", "Hello\n\r\n\r".cleanLlmText())
    }

    @Test
    fun `trims both ends and removes newlines`() {
        assertEquals("Hello", "   \tHello\n".cleanLlmText())
    }

    @Test
    fun `leaves clean string unchanged`() {
        assertEquals("Hello", "Hello".cleanLlmText())
    }
}
