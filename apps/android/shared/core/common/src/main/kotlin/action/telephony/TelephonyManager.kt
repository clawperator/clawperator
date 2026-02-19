package action.telephony

import action.language.Iso

/**
 * Wrapper for [android.telephony.TelephonyManager].
 */
interface TelephonyManager {
    fun resolveSimCountryIso(): Iso?

    fun resolveNetworkCountryIso(): Iso?
}

/**
 *
 */
class TelephonyManagerMock(
    private val simCountryIso: Iso? = "us",
    private val networkCountryIso: Iso? = "us",
) : TelephonyManager {
    override fun resolveSimCountryIso(): Iso? = simCountryIso

    override fun resolveNetworkCountryIso(): Iso? = networkCountryIso
}
