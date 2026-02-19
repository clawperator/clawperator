package action.preference

typealias PreferenceInfoDefaultBlock<T> = () -> T

data class PreferenceInfo<T>(
    val key: String,
    val default: PreferenceInfoDefaultBlock<T>,
) {
    constructor(key: String, default: T) : this(key, { default })
}
