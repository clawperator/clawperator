package action.settings

class SettingsUpdateDispatcher(
    settings: List<Settings>,
) : Settings.OnSettingChangeListener {
    constructor(settings: Settings) : this(listOf(settings))

    private val listeners = HashMap<String, () -> Unit>()

    init {
        settings.forEach {
            it.registerOnSettingChangeListener(this)
        }
    }

    override fun onSettingChanged(
        settings: Settings,
        key: String?,
    ) {
        listeners[key]?.invoke()
    }

    fun onUpdate(
        key: String,
        listener: () -> Unit,
    ) {
        listeners[key] = listener
    }
}
