package action.system.unit

import androidx.compose.ui.unit.Dp

class SystemUnitManagerMock(
    private val density: Float = SystemUnitMockDensity,
) : SystemUnitManager {
    companion object {
        val SystemUnitMockDensity = 2f
    }

    override fun dpToPx(dp: Float): Float = dp * density

    override fun dpToPx(dp: Int): Float = dpToPx(dp.toFloat())

    override fun dpToPx(dp: Dp): Float = dpToPx(dp.value)

    override fun pxToDp(px: Float): Dp = Dp(px / density)

    override fun pxToDp(px: Int): Dp = pxToDp(px.toFloat())
}
