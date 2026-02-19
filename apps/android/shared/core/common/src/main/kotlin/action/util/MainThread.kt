package action.util

import android.os.Looper

/** Returns true if the calling thread is the main thread. */
fun isMainThread(): Boolean = Looper.getMainLooper().thread === Thread.currentThread()

/** Asserts if called from the main thread. */
fun assertNotMainThread(onMainThread: (() -> Unit)? = null) {
    if (isMainThread()) {
        onMainThread?.invoke()
        throw IllegalStateException("Cannot perform operation on the main thread.")
    }
}
