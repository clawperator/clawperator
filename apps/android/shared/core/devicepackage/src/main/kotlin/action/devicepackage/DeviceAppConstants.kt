package action.devicepackage

import action.devicepackage.DeviceAppConstants.Companion.DUMMY_ACTIVITY_SUFFIX
import action.system.model.ComponentKey

class DeviceAppConstants {
    companion object {
        private var app_id: String? = null

        const val APP_ID_ADAPTIVEPACK = "com.action.adaptiveiconpack"
        const val APP_ID_ANDROID_CALENDAR = "com.android.calendar"
        const val APP_ID_ANDROID_CLOCK = "com.android.deskclock"
        const val APP_ID_ANDROID_MESSAGING = "com.android.messaging"
        const val APP_ID_CHROME = "com.android.chrome"
        const val APP_ID_FACEBOOK = "com.facebook.katana"
        const val APP_ID_FACEBOOK_MESSENGER = "com.facebook.orca"
        const val APP_ID_GMAIL = "com.google.android.gm"
        const val APP_ID_GOOGLE_APP = "com.google.android.googlequicksearchbox"
        const val APP_ID_GOOGLE_ASSISTANT = "com.google.android.apps.googleassistant"
        const val APP_ID_GOOGLE_CALCULATOR = "com.google.android.calculator"
        const val APP_ID_GOOGLE_CAMERA = "com.google.android.GoogleCamera"
        const val APP_ID_GOOGLE_CALENDAR = "com.google.android.calendar"
        const val APP_ID_GOOGLE_CLOCK = "com.google.android.deskclock"
        const val APP_ID_GOOGLE_CONTACTS = "com.google.android.contacts"
        const val APP_ID_GOOGLE_DIALER = "com.google.android.dialer"
        const val APP_ID_GOOGLE_DOCS = "com.google.android.apps.docs.editors.docs"
        const val APP_ID_GOOGLE_DRIVE = "com.google.android.apps.docs"
        const val APP_ID_GOOGLE_HANGOUTS = "com.google.android.talk"
        const val APP_ID_GOOGLE_INBOX = "com.google.android.apps.inbox"
        const val APP_ID_GOOGLE_KEEP = "com.google.android.keep"
        const val APP_ID_GOOGLE_MAPS = "com.google.android.apps.maps"
        const val APP_ID_GOOGLE_MESSENGER = "com.google.android.apps.messaging"
        const val APP_ID_GOOGLE_PLAY_SERVICES = "com.google.android.gms"
        const val APP_ID_GOOGLE_PLUS = "com.google.android.apps.plus"
        const val APP_ID_GOOGLE_PHOTOS = "com.google.android.apps.photos"
        const val APP_ID_GOOGLE_SHEETS = "com.google.android.apps.docs.editors.sheets"
        const val APP_ID_GOOGLE_WALLPAPER = "com.google.android.apps.wallpaper"
        const val APP_ID_INSTAGRAM = "com.instagram.android"
        const val APP_ID_NETFLIX = "com.netflix.mediaclient"
        const val APP_ID_PIXEL_LAUNCHER = "com.google.android.apps.nexuslauncher"
        const val APP_ID_PIXEL_MIGRATE = "com.google.android.apps.pixelmigrate"
        const val APP_ID_PIXEL_STAND = "com.google.android.apps.dreamliner"
        const val APP_ID_PIXEL_WALLPAPERS_18 = "com.breel.wallpapers18"
        const val APP_ID_PLAY_MAGAZINES = "com.google.android.apps.magazines"
        const val APP_ID_PLAY_MUSIC = "com.google.android.music"
        const val APP_ID_PLAY_MOVIES = "com.google.android.videos"
        const val APP_ID_PLAY_STORE = "com.android.vending"
        const val APP_ID_POCKET_CASTS = "au.com.shiftyjelly.pocketcasts"
        const val APP_ID_SAMSUNG_CALENDAR = "com.sec.android.app.latin.launcher.calendar"
        const val APP_ID_SPOTIFY = "com.spotify.music"
        const val APP_ID_TODAY_CALENDAR = "com.underwood.calendar"
        const val APP_ID_TWITTER = "com.twitter.android"
        const val APP_ID_YOUTUBE = "com.google.android.youtube"
        const val APP_ID_WHATSAPP = "com.whatsapp"

        const val CLASS_NAME_LEAK_CANARY = "com.squareup.leakcanary.internal.DisplayLeakActivity"

        // Internal system apps
        const val SYSTEM_APP_ID_ANDROID = "android"
        const val SYSTEM_APP_ID_DOWNLOADS = "com.android.providers.downloads"
        const val SYSTEM_APP_ID_FACTORY_OTA_MODE = "com.google.android.factoryota"
        const val SYSTEM_APP_ID_GMS = "com.google.android.gms"
        const val SYSTEM_APP_ID_HOTWORD_ENROLLMENT_1 = "com.android.hotwordenrollment.okgoogle" // "OK Google enrollment"
        const val SYSTEM_APP_ID_HOTWORD_ENROLLMENT_2 = "com.android.hotwordenrollment.xgoogle" // "X Google enrollment"
        const val SYSTEM_APP_ID_LIVE_WALLPAPER_PICKER = "com.android.wallpaper.livepicker"
        const val SYSTEM_APP_ID_MTP_HOST = "com.android.mtp"
        const val SYSTEM_APP_ID_PACKAGE_INSTALLER = "com.google.android.packageinstaller"
        const val SYSTEM_APP_ID_PIXEL_AMBIENT_SERVICES = "com.google.intelligence.sense"
        const val SYSTEM_APP_ID_SETUP_WIZARD = "com.google.android.setupwizard"
        const val SYSTEM_APP_ID_SYSTEM_UI = "com.android.systemui"

        internal const val DUMMY_ACTIVITY_SUFFIX = ".Activity"

        val systemAppIds by lazy {
            listOf(
                APP_ID_PIXEL_STAND,
                APP_ID_PIXEL_LAUNCHER,
                APP_ID_PIXEL_MIGRATE,
                APP_ID_PIXEL_WALLPAPERS_18,
                SYSTEM_APP_ID_ANDROID,
                SYSTEM_APP_ID_DOWNLOADS,
                SYSTEM_APP_ID_FACTORY_OTA_MODE,
                SYSTEM_APP_ID_GMS,
                SYSTEM_APP_ID_HOTWORD_ENROLLMENT_1,
                SYSTEM_APP_ID_HOTWORD_ENROLLMENT_2,
                SYSTEM_APP_ID_LIVE_WALLPAPER_PICKER,
                SYSTEM_APP_ID_MTP_HOST,
                SYSTEM_APP_ID_PACKAGE_INSTALLER,
                SYSTEM_APP_ID_PIXEL_AMBIENT_SERVICES,
                SYSTEM_APP_ID_SETUP_WIZARD,
                SYSTEM_APP_ID_SYSTEM_UI,
            )
        }

        fun setAppId(appId: String) {
            app_id = appId
        }
    }
}

fun String.asDummyActivity(): String = "${this}$DUMMY_ACTIVITY_SUFFIX"

fun String.asDemoComponentKey(): ComponentKey = ComponentKey(this, asDummyActivity())
