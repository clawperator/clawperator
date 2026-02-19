package action.type

// @Keep
enum class MediaType(
    val code: String,
) {
    Audio("audio"),
    Image("image"),
    Video("video"),
}

fun asMediaType(code: String?): MediaType? = MediaType.entries.find { it.code == code }
