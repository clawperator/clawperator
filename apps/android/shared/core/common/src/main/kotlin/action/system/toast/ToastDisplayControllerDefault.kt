package action.system.toast

import action.context.toast
import action.log.Log
import android.content.Context
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class ToastDisplayControllerDefault(
    private val context: Context,
    private val coroutineScopeMain: CoroutineScope,
) : ToastDisplayController {
    private var lastToast: Toast? = null

    override fun showToast(
        message: String,
        isLong: Boolean,
        cancelPrevious: Boolean,
    ) {
        coroutineScopeMain.launch {
            if (cancelPrevious) lastToast?.cancel()
            lastToast = context.toast(message, isLong)
            Log.d("showToast(): $message")
        }
    }

    override fun showToast(
        message: Int,
        isLong: Boolean,
        cancelPrevious: Boolean,
    ) {
        coroutineScopeMain.launch {
            showToast(context.getString(message), isLong, cancelPrevious)
        }
    }
}
