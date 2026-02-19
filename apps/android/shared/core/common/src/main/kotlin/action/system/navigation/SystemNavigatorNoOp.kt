package action.system.navigation

import action.system.model.ComponentKey

class SystemNavigatorNoOp : SystemNavigator {
    override fun toUrl(url: String) { }

    override fun toMailTo(
        recipients: List<String>,
        subject: String,
    ): Boolean = false

    override fun toGoogleSearch(query: String?): Boolean = false

    override fun toYouTubeVideo(youTubeVideoId: String) { }

    override fun toSystemAppInfo(componentKey: ComponentKey) { }

    override fun toSystemSetAppAsLiveWallpaper(): Boolean = false

    override fun toSystemDefaultAppsScreen() { }

    override fun toVoiceSearch(): Boolean = false
}
