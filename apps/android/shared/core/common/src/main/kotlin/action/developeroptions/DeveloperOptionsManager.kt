package action.developeroptions

import kotlinx.coroutines.flow.Flow

/**
 * Determines developer-related system state:
 * - [isEnabled]: Developer options menu is unlocked (e.g. user tapped "Build number" 7 times).
 * - [isUsbDebuggingEnabled]: USB debugging is turned on in Developer options.
 */
interface DeveloperOptionsManager {
    /** True when developer options are enabled (Build number tapped 7 times). */
    val isEnabled: Flow<Boolean>

    /** True when USB debugging is enabled in Developer options. */
    val isUsbDebuggingEnabled: Flow<Boolean>
}
