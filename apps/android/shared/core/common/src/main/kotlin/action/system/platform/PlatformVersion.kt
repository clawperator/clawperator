package action.system.platform

import android.os.Build
import android.os.Build.VERSION_CODES
import androidx.annotation.ChecksSdkIntAtLeast

object PlatformVersion {
    val AtLeast_O = Build.VERSION.SDK_INT >= VERSION_CODES.O

    val AtLeast_O_MR1 = Build.VERSION.SDK_INT >= VERSION_CODES.O_MR1

    val AtLeast_P = Build.VERSION.SDK_INT >= VERSION_CODES.P

    val AtLeast_Q = Build.VERSION.SDK_INT >= VERSION_CODES.Q

    @ChecksSdkIntAtLeast(api = VERSION_CODES.R)
    val AtLeast_R = Build.VERSION.SDK_INT >= VERSION_CODES.R

    @ChecksSdkIntAtLeast(api = VERSION_CODES.S)
    val AtLeast_S = Build.VERSION.SDK_INT >= VERSION_CODES.S

    val AtLeast_S_V2 = Build.VERSION.SDK_INT >= VERSION_CODES.S_V2

    @ChecksSdkIntAtLeast(api = VERSION_CODES.TIRAMISU, codename = "T")
    val AtLeast_T = Build.VERSION.SDK_INT >= VERSION_CODES.TIRAMISU

    @ChecksSdkIntAtLeast(api = VERSION_CODES.UPSIDE_DOWN_CAKE, codename = "U")
    val AtLeast_U = Build.VERSION.SDK_INT >= VERSION_CODES.UPSIDE_DOWN_CAKE

    @ChecksSdkIntAtLeast(api = VERSION_CODES.VANILLA_ICE_CREAM, codename = "V")
    val AtLeast_V = Build.VERSION.SDK_INT >= VERSION_CODES.VANILLA_ICE_CREAM
}
