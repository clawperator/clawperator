package action.buildconfig

import android.annotation.SuppressLint
import android.os.Build
import androidx.annotation.ChecksSdkIntAtLeast

object BuildUtils {
    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    val AT_LEAST_ANDROID_14 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.TIRAMISU)
    val AT_LEAST_ANDROID_13 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.S)
    val AT_LEAST_ANDROID_12 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.R)
    val AT_LEAST_ANDROID_11 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.Q)
    val AT_LEAST_ANDROID_10 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.P)
    val AT_LEAST_ANDROID_9 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.O)
    val AT_LEAST_ANDROID_8 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.N_MR1)
    val AT_LEAST_ANDROID_7_1 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.N)
    val AT_LEAST_ANDROID_7 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.M)
    val AT_LEAST_ANDROID_6 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.LOLLIPOP_MR1)
    val AT_LEAST_ANDROID_5_1 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1

    @SuppressLint("ObsoleteSdkInt")
    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.LOLLIPOP)
    val AT_LEAST_ANDROID_5 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP
}
