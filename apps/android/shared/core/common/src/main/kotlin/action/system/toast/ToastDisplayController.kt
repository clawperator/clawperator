package action.system.toast

interface ToastDisplayController {
    fun showToast(
        message: String,
        isLong: Boolean = false,
        cancelPrevious: Boolean = true,
    )

    fun showToast(
        message: Int,
        isLong: Boolean = false,
        cancelPrevious: Boolean = true,
    )
}
