package action.system.toast

import action.log.Log

object ToastDisplayControllerNoOp : ToastDisplayController {
    override fun showToast(
        message: String,
        isLong: Boolean,
        cancelPrevious: Boolean,
    ) {
        Log.i(message = "ToastDisplayControllerNoOp: $message")
    }

    override fun showToast(
        message: Int,
        isLong: Boolean,
        cancelPrevious: Boolean,
    ) {
        Log.i(message = "ToastDisplayControllerNoOp: $message")
    }
}
