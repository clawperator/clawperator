package action.system.platform

import android.content.Context

interface PlatformContext

object PlatformContextNoOp : PlatformContext

data class PlatformContextAndroid(
    val context: Context,
) : PlatformContext
