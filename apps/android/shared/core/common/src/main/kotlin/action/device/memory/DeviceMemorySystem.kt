package action.device.memory

import action.log.Log
import android.app.ActivityManager
import android.content.Context

class DeviceMemorySystem(
    context: Context,
) : DeviceMemory() {
    override val memory: Long by lazy {
        val result = ActivityManager.MemoryInfo()
        (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(result)
        result.totalMem
    }

    init {
        Log.d("init(), memory: $memory, memoryMb: $memoryMb, memoryGb: $memoryGb")
    }
}
