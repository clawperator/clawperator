package action.system.unit

import android.content.Context
import androidx.compose.ui.unit.Dp

class SystemUnitManagerAndroid(
    val context: Context,
) : SystemUnitManager {
    private val resources by lazy { context.resources }

    override fun dpToPx(dp: Float): Float = dp * (resources.displayMetrics.densityDpi / 160f)

    override fun dpToPx(dp: Int): Float = dpToPx(dp.toFloat())

    override fun dpToPx(dp: Dp): Float = dpToPx(dp.value)

    override fun pxToDp(px: Float): Dp = Dp(px / (resources.displayMetrics.densityDpi / 160f))

    override fun pxToDp(px: Int): Dp = pxToDp(px.toFloat())
}
