package action.resource

import action.system.model.IntentKey
import android.content.Intent

fun IntentKey(intent: Intent): IntentKey {
    val modifiedIntent = Intent(intent)

    // Manually serialize the nested shortcut intent if present
    intent.getParcelableExtra<Intent>(Intent.EXTRA_SHORTCUT_INTENT)?.let { shortcutIntent ->
        modifiedIntent.putExtra(Intent.EXTRA_SHORTCUT_INTENT, shortcutIntent.toUri(Intent.URI_INTENT_SCHEME))
    }

    return IntentKey(modifiedIntent.toUri(Intent.URI_INTENT_SCHEME))
}

val IntentKey.intent: Intent
    get() {
        val restoredIntent = Intent.parseUri(serializedIntent, Intent.URI_INTENT_SCHEME)

        // Manually deserialize the nested shortcut intent if present
        restoredIntent.getStringExtra(Intent.EXTRA_SHORTCUT_INTENT)?.let { shortcutUri ->
            restoredIntent.putExtra(Intent.EXTRA_SHORTCUT_INTENT, Intent.parseUri(shortcutUri, Intent.URI_INTENT_SCHEME))
        }

        return restoredIntent
    }
