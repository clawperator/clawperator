package action.battery

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData

interface BatteryManager {
    val isCharging: LiveData<Boolean>
}

class BatteryManagerMock(
    override val isCharging: LiveData<Boolean>,
) : BatteryManager {
    constructor(isCharging: Boolean = false) : this(MutableLiveData(isCharging))
}
