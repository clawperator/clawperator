package action.telephony

import action.language.Iso
import android.content.Context

/**
 *
 */
class TelephonyManagerSystem(
    context: Context,
) : TelephonyManager {
    private val telephonyManager by lazy {
        context.getSystemService(Context.TELEPHONY_SERVICE) as android.telephony.TelephonyManager
    }

    override fun resolveSimCountryIso(): Iso? =
        try {
            telephonyManager.simCountryIso
        } catch (e: Exception) {
            null
        }

    override fun resolveNetworkCountryIso(): Iso? =
        try {
            telephonyManager.networkCountryIso
        } catch (e: Exception) {
            null
        }
}
