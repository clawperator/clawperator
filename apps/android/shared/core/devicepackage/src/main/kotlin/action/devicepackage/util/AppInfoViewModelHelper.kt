package action.devicepackage.util

import action.coroutine.CoroutineContextProvider
import action.devicepackage.PackageRepository
import action.devicepackage.appinfo.AppInfo
import action.system.model.ComponentKey
import action.utils.updateValueIfNew
import android.graphics.drawable.Drawable
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.Observer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Helper class for use in ViewModels to manage LiveData variables for [AppInfo].
 */
class AppInfoViewModelHelper(
    private val packageRepository: PackageRepository,
    private val coroutineContextProvider: CoroutineContextProvider,
) {
    private val _appInfo = MutableLiveData<AppInfo?>()
    val appInfo: LiveData<AppInfo?>
        get() = _appInfo
    private val appInfoObserver =
        Observer<AppInfo?> { appInfo ->
            appInfo?.getIcon()?.also {
                it.removeObserver(appIconObserver)
                it.observeForever(appIconObserver)
            }
        }

    private val _appIcon = MutableLiveData<Drawable>()
    val appIcon: LiveData<Drawable>
        get() = _appIcon
    private val appIconObserver =
        Observer<Drawable> {
            _appIcon.updateValueIfNew(it)
        }

    fun update(
        componentKey: ComponentKey?,
        coroutineScope: CoroutineScope,
    ) {
        _appInfo.observeForever(appInfoObserver)

        if (componentKey != _appInfo.value?.getComponentKey()) {
            coroutineScope.launch(coroutineContextProvider.io) {
                val appInfo =
                    componentKey?.let {
                        packageRepository.getAppInfos(it.applicationId).firstOrNull()
                    }
                _appInfo.postValue(appInfo)
            }
        }
    }

    fun onCleared() {
        _appInfo.value?.getIcon()?.removeObserver(appIconObserver)
        _appInfo.removeObserver(appInfoObserver)
    }
}
