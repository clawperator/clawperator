package action.type

enum class Side(
    val code: String,
) {
    Left("left"),
    Right("right"),
}

fun asSide(code: String?): Side? = Side.entries.find { it.code == code }
