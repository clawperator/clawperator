package action.crashtracking

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object LocalCrashLog {
    private const val LOG_FILE_NAME = "crash-log.txt"
    private const val TAG = "LocalCrashLog"

    private val lock = Any()
    private var logFile: File? = null
    private var installed = false

    fun installUncaughtExceptionHandler(context: Any) {
        val appContext = context as? Context ?: return
        ensureFile(appContext)
        if (installed) return
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                append("FATAL", thread, "Uncaught exception", throwable)
            } catch (t: Throwable) {
                Log.e(TAG, "Failed to log uncaught exception", t)
            } finally {
                previousHandler?.uncaughtException(thread, throwable)
            }
        }
        installed = true
    }

    fun hasExistingLog(): Boolean {
        val file = logFile
        return file != null && file.exists() && file.length() > 0L
    }

    fun logInfo(message: String, throwable: Throwable? = null) {
        append("INFO", Thread.currentThread(), message, throwable)
    }

    fun logWarning(message: String, throwable: Throwable? = null) {
        append("WARN", Thread.currentThread(), message, throwable)
    }

    private fun ensureFile(context: Context) {
        if (logFile != null) return
        logFile = File(context.filesDir, LOG_FILE_NAME)
    }

    private fun append(
        level: String,
        thread: Thread,
        message: String,
        throwable: Throwable?,
    ) {
        val file = logFile ?: return
        val timestamp = formatTimestamp(Date())
        val builder = StringBuilder()
            .append(timestamp)
            .append(" [")
            .append(level)
            .append("] [")
            .append(thread.name)
            .append("] ")
            .append(message)
            .append('\n')
        if (throwable != null) {
            builder.append(throwable.stackTraceToString()).append('\n')
        }
        try {
            synchronized(lock) {
                FileOutputStream(file, true).use { stream ->
                    stream.write(builder.toString().toByteArray(Charsets.UTF_8))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to append crash log", e)
        }
    }

    private fun formatTimestamp(date: Date): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)
        return formatter.format(date)
    }
}
