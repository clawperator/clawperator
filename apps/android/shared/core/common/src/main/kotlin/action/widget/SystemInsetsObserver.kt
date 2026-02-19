package action.widget

import action.common.R
import action.context.resolveAttributeDimension
import android.content.Context
import android.graphics.Rect
import android.view.View
import androidx.appcompat.widget.Toolbar
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import androidx.lifecycle.Observer

/**
 * Configures an [Observer] to update the [toolbar] and [content] positions
 * based on the system insets.
 */
fun systemInsetsObserver(
    context: Context,
    toolbar: Toolbar,
    content: View,
) = Observer<Rect> {
    val topOffsetHeight = context.resolveAttributeDimension(R.attr.actionBarSize)

    toolbar.updateLayoutParams { height = it.top + topOffsetHeight }
    toolbar.updatePadding(top = it.top)
    content.updatePadding(bottom = it.bottom)
}
