package action.system.navigation

import action.system.model.ComponentKey

interface SystemNavigator {
    fun toUrl(url: String)

    fun toMailTo(
        recipients: List<String>,
        subject: String,
    ): Boolean

    fun toGoogleSearch(query: String?): Boolean

    fun toYouTubeVideo(youTubeVideoId: String)

    fun toSystemAppInfo(componentKey: ComponentKey)

    fun toSystemDefaultAppsScreen()

    fun toSystemSetAppAsLiveWallpaper(): Boolean

    fun toVoiceSearch(): Boolean
}
