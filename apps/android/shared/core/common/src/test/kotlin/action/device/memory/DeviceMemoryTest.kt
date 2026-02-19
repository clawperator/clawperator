package action.device.memory

import kotlin.test.Test
import kotlin.test.assertEquals

class DeviceMemoryTest {
    @Test fun `handles unknown memory values`() {
        assertEquals(0, DeviceMemoryMock(0L).memory)
        assertEquals(0.0, DeviceMemoryMock(0L).memoryGb)
    }
}
