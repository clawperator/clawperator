package action.devicepackage.alias

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes

data class AppInfoAliasMapping(
    val appId: String,
    @StringRes val aliasLabel: Int,
    @DrawableRes val aliasIcon: Int,
)
