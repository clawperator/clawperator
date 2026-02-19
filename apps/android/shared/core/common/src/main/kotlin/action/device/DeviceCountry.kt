package action.device

import action.language.Iso
import action.language.LocaleRepository
import action.telephony.TelephonyManager

/**
 * Use to fetch country related information about this device.
 *
 * See also [LocaleRepository].
 */
interface DeviceCountry {
    /**
     * Returns the best determinable [Iso] code. Checks SIM card,
     * network, and failing that,
     */
    fun resolveBestCountryIso(): Iso?
}

class DeviceCountryMock(
    var bestCountryIso: Iso? = null,
) : DeviceCountry {
    override fun resolveBestCountryIso(): Iso? = bestCountryIso
}

/**
 *
 */
class DeviceCountryDefault(
    private val localeRepository: LocaleRepository,
    private val telephonyManager: TelephonyManager,
) : DeviceCountry {
    override fun resolveBestCountryIso(): Iso? {
        val simCountryIso = telephonyManager.resolveSimCountryIso()
        if (simCountryIso?.isNotEmpty() == true) return simCountryIso

        val networkCountryIso = telephonyManager.resolveNetworkCountryIso()
        if (networkCountryIso?.isNotEmpty() == true) return networkCountryIso

        return localeRepository.localeCountry?.lowercase()
    }
}
