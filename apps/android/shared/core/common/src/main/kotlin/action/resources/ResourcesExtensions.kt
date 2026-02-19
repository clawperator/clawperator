package action.resources

import android.content.pm.PackageManager
import android.content.res.Resources
import android.content.res.Resources.NotFoundException
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.LocaleList
import android.util.TypedValue
import androidx.annotation.ColorRes
import androidx.annotation.DrawableRes
import androidx.core.content.res.ResourcesCompat
import java.util.Locale

fun Resources.resolveLocale(): Locale =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        with(configuration.locales) {
            if (size() > 0) {
                get(0)
            } else {
                LocaleList.getDefault().get(0)
            }
        }
    } else {
        @Suppress("DEPRECATION")
        configuration.locale
    }

fun Resources.isXmlResource(
    @DrawableRes drawableId: Int,
): Boolean {
    val fileName =
        TypedValue().let {
            getValue(drawableId, it, true)
            it.string
        }
    return fileName?.toString()?.endsWith(".xml") == true
}

fun Resources.getColorCompat(
    @ColorRes color: Int,
    theme: Resources.Theme? = null,
): Int = ResourcesCompat.getColor(this, color, theme)

fun Resources.getDrawableChecked(
    @DrawableRes drawableId: Int,
): Drawable? = getDrawableChecked(drawableId, null)

fun Resources.getDrawableChecked(
    @DrawableRes drawableId: Int,
    theme: Resources.Theme?,
): Drawable? =
    try {
        ResourcesCompat.getDrawable(this, drawableId, theme)
    } catch (ex: NotFoundException) {
        null
    }

fun Resources.getDrawableForDensityChecked(
    @DrawableRes iconRes: Int,
    density: Int,
    theme: Resources.Theme? = null,
): Drawable? {
    if (density != 0 && iconRes != 0) {
        try {
            return getDrawableForDensity(iconRes, density, theme)
        } catch (ignored: PackageManager.NameNotFoundException) {
        } catch (ignored: Resources.NotFoundException) {
        } catch (ignored: NullPointerException) {
            // Certain devices, like the "Lenovo TAB 2 A7-30HC" running Android 5.0, raise a NPE here.
        }
    }
    return null
}
