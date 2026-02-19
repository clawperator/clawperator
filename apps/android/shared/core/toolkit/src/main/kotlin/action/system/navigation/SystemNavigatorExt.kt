package action.system.navigation

import android.app.SearchManager
import android.content.Context
import android.content.Intent
import android.speech.RecognizerIntent

fun Context.findVoiceSearchIntent(): Intent? {
    val searchManager = getSystemService(Context.SEARCH_SERVICE) as SearchManager
    val packageManager = packageManager
    val activityName = searchManager.globalSearchActivity

    // First, check the new CLASSIC_GSA_VOICE_SEARCH filter.
    var intent =
        Intent("com.google.android.googlequicksearchbox.action.CLASSIC_GSA_VOICE_SEARCH")
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (activityName != null) {
        intent.setPackage(activityName.packageName)
    }
    var results = packageManager.queryIntentActivities(intent, 0)
    if (results.size > 0) {
        return intent
    }

    // Failing that, check for the typical filter
    intent =
        Intent(RecognizerIntent.ACTION_WEB_SEARCH)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (activityName != null) {
        intent.setPackage(activityName.packageName)
    }
    results = packageManager.queryIntentActivities(intent, 0)
    if (results.size > 0) {
        return intent
    }

    // Last ditch attempt without specifying the activity.
    intent =
        Intent(RecognizerIntent.ACTION_WEB_SEARCH)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    results = packageManager.queryIntentActivities(intent, 0)
    if (results.size > 0) {
        return intent
    }

    return null
}
