package action.network

import android.os.Handler
import android.os.Looper
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okio.BufferedSink
import java.io.File
import java.io.FileInputStream
import java.io.IOException

class ProgressRequestBody(
    private val mFile: File,
    private val content_type: String,
    private val mListener: UploadCallbacks,
) : RequestBody() {
    interface UploadCallbacks {
        fun onProgressUpdate(percentage: Int)

        fun onFinish()
    }

    override fun contentType(): MediaType? = "$content_type/*".toMediaTypeOrNull()

    @Throws(IOException::class)
    override fun contentLength(): Long = mFile.length()

    @Throws(IOException::class)
    override fun writeTo(sink: BufferedSink) {
        val fileLength = mFile.length()
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        val inputStream = FileInputStream(mFile)
        var uploaded: Long = 0

        inputStream.use { input ->
            var read: Int
            val handler = Handler(Looper.getMainLooper())
            while (true) {
                read = input.read(buffer)
                if (read == -1) break

                // update progress on UI thread
                handler.post(ProgressUpdater(uploaded, fileLength))

                uploaded += read.toLong()
                sink.write(buffer, 0, read)
            }
        }
    }

    private inner class ProgressUpdater(
        private val mUploaded: Long,
        private val mTotal: Long,
    ) : Runnable {
        override fun run() {
            mListener.onProgressUpdate((100 * mUploaded / mTotal).toInt())
            if (mUploaded == mTotal) mListener.onFinish()
        }
    }

    companion object {
        private const val DEFAULT_BUFFER_SIZE = 1024
    }
}
