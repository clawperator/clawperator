package action.intent

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * A new requirement of Android 31:
 *
 *   Targeting S+ (version 31 and above) requires that one of FLAG_IMMUTABLE or FLAG_MUTABLE be
 *   specified when creating a PendingIntent. Strongly consider using FLAG_IMMUTABLE, only use
 *   FLAG_MUTABLE if some functionality depends on the PendingIntent being mutable, e.g. if it
 *   needs to be used with inline replies or bubbles.
 *
 *  This class handles such requirements.
 */
object PendingIntentCompat {
    fun getFlags(
        flags: Int,
        isImmutable: Boolean,
        buildVersion: Int = Build.VERSION.SDK_INT,
    ): Int =
        if (buildVersion >= 23) {
            if (isImmutable) {
                (flags or PendingIntent.FLAG_IMMUTABLE)
            } else {
                if (buildVersion >= 31) {
                    (flags or PendingIntent.FLAG_MUTABLE)
                } else {
                    flags
                }
            }
        } else {
            flags
        }

    fun getActivity(
        context: Context,
        requestCode: Int,
        intent: Intent,
        flags: Int,
        isImmutable: Boolean = true,
    ): PendingIntent? = PendingIntent.getActivity(context, requestCode, intent, getFlags(flags, isImmutable))

    fun getService(
        context: Context,
        requestCode: Int,
        intent: Intent,
        flags: Int,
        isImmutable: Boolean = true,
    ): PendingIntent? = PendingIntent.getService(context, requestCode, intent, getFlags(flags, isImmutable))

    fun getBroadcast(
        context: Context,
        requestCode: Int,
        intent: Intent,
        flags: Int,
        isImmutable: Boolean = true,
    ): PendingIntent? = PendingIntent.getBroadcast(context, requestCode, intent, getFlags(flags, isImmutable))
}
