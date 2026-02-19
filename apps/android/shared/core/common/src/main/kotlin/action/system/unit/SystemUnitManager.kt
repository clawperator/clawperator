package action.system.unit

import androidx.compose.ui.unit.Dp

interface SystemUnitManager {
    fun dpToPx(dp: Float): Float

    fun dpToPx(dp: Int): Float

    fun dpToPx(dp: Dp): Float

    fun pxToDp(px: Float): Dp

    fun pxToDp(px: Int): Dp
}
