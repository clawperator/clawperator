package action.appvisibility

import kotlinx.coroutines.flow.Flow

interface AppVisibility {
    /**
     * Is the app 'visible'. This will be true if any of the following are true:
     *   - An app's Activity is displaying.
     *   - The app is in use as the current live wallpaper app.
     */
    val isVisible: Flow<Boolean>
    val visible: Boolean
}
