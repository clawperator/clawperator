package action.device

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DeviceIdSystemKtTest {
    @Test fun `isValidAndroidId() invalid ids return false`() {
        assertFalse("".isValidAndroidId())
        assertFalse("0".isValidAndroidId())
        assertFalse("1".isValidAndroidId())
        assertFalse("-1".isValidAndroidId())
        assertFalse("22".isValidAndroidId())
        assertFalse("null".isValidAndroidId())
        assertFalse("id".isValidAndroidId())
        assertFalse("unknown".isValidAndroidId())
    }

    @Test fun `isValidAndroidId() valid ids return true`() {
        assertTrue("123456789".isValidAndroidId())
        assertTrue(UUID.randomUUID().toString().isValidAndroidId())
    }
}
