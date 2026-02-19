package action.system.settings

interface SystemSettingsRepository {
    val isUsingAutomaticSystemTime: Boolean
}

class SystemSettingsRepositoryMock(
    override var isUsingAutomaticSystemTime: Boolean = true,
) : SystemSettingsRepository
