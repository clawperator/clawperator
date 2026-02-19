package action.process

import action.log.Log
import android.app.ActivityManager
import android.app.Application
import android.content.Context
import android.os.Build
import java.io.FileInputStream

/**
 *
 */
class ProcessDefault(
    private val context: Context,
) : Process {
    private val _processName: String by lazy {
        val pid = android.os.Process.myPid()
        val processName =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                Application.getProcessName()
            } else {
                try {
                    FileInputStream("/proc/$pid/cmdline")
                        .buffered()
                        .readBytes()
                        .filter { it > 0 }
                        .toByteArray()
                        .inputStream()
                        .reader(Charsets.ISO_8859_1)
                        .use { it.readText() }
                } catch (e: Throwable) {
                    null
                }
            }

        if (processName != null) {
            processName
        } else {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            manager
                ?.runningAppProcesses
                ?.filterNotNull()
                ?.firstOrNull { it.pid == pid }
                ?.processName!!
        }
    }
    override val processName: String
        get() = _processName

    private val _processNameSuffix: String? by lazy { extractProcessSuffix(processName) }
    override val processNameSuffix: String?
        get() = _processNameSuffix

    override val isDefaultProcess: Boolean
        get() = processNameSuffix == null

    override val isTestProcess: Boolean
        get() = processName.contains("robolectric")

    override fun toString(): String = "processName: $_processName, processNameSuffix: $processNameSuffix, isDefaultProcess: $isDefaultProcess"

    init {
        Log.d(toString())
    }
}
