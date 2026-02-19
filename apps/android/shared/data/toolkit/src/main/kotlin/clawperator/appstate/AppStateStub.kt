package clawperator.appstate

import action.time.TimeRepositoryMock
import clawperator.prefs.DevicePreferenceStorageStub

class AppStateStub(
    devicePreferenceStorage: DevicePreferenceStorageStub = DevicePreferenceStorageStub(),
    timeRepository: TimeRepositoryMock = TimeRepositoryMock(),
) : AppStateMainProcess(devicePreferenceStorage, timeRepository)
