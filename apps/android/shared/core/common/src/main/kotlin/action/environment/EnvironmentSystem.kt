package action.environment

import android.content.Context
import java.io.File

/**
 *
 */
class EnvironmentSystem(
    private val context: Context,
) : Environment {
    override val cacheDirectory: File
        get() = context.cacheDir

    override val filesDirectory: File
        get() = context.filesDir

    override val externalFilesDirectory: File?
        get() = context.getExternalFilesDir(null)
}
