package action.json

import org.json.JSONObject
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

@RunWith(RobolectricTestRunner::class)
class JsonExtensionsKtTest {
    @Test fun `JSONObject getOpt() returns null when not preset`() {
        assertNull(JSONObject().getOpt<Long>("long"))
    }

    @Test fun `JSONObject getOpt() returns default when not preset`() {
        assertEquals(99L, JSONObject().getOpt("long", 99L))
    }

    @Test fun `JSONObject getOpt() returns value when preset`() {
        with(JSONObject()) {
            put("long", 99L)
            assertEquals(99L, getOpt<Long>("long"))
            assertEquals(99L, getOpt("long", 88L))
        }
    }

    @Test fun `toSetString() setOf valid Strings`() {
        assertEquals("setOf([a, b, c])", setOf("a", "b", "c").toSetString())
    }

    @Test fun `toSetString() empty setOf String`() {
        assertEquals("setOf([])", setOf<String>().toSetString())
    }

    @Test fun `asStringString() with setOf Strings returns expected`() {
        assertEquals(setOf("a", "b", "c"), "setOf([a, b, c])".asStringSet())
    }

    @Test fun `asStringString() with empty setOf returns null`() {
        assertEquals(setOf<String>(), "setOf([])".asStringSet())
    }

    @Test fun `asStringString() with non-set returns null`() {
        assertNull("[]".asStringSet())
        assertNull("string".asStringSet())
    }
}
