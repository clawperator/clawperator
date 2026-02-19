package action.environment

import java.io.File

/**
 * A wrapper for [android.os.Environment].
 */
interface Environment {
    val cacheDirectory: File

    val filesDirectory: File

    val externalFilesDirectory: File?
}

class EnvironmentMock(
    val directory: String,
) : Environment {
    override val cacheDirectory: File
        get() = File(directory)
    override val filesDirectory: File
        get() = File(directory)
    override val externalFilesDirectory: File?
        get() = File(directory)
}
