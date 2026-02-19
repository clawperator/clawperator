package action.device.memory

abstract class DeviceMemory {
    abstract val memory: Long

    val memoryMb: Long by lazy {
        (memory.toDouble() / 1024.0 / 1024.0).toLong()
    }

    val memoryGb: Double
        get() = memoryMb.toDouble() / 1024.0
}

class DeviceMemoryMock(
    override var memory: Long = 4 * 1024 * 1024L * 1024L,
) : DeviceMemory()
