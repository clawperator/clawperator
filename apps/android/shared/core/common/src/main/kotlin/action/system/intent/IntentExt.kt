package action.system.intent

import android.content.Intent

val IntentWrapper.intent: Intent
    get() {
        require(this is IntentWrapperAndroid)
        return intent
    }

val Intent.wrapper: IntentWrapper
    get() = IntentWrapperAndroid(this)

@get:JvmName("wrapperNullable")
val Intent?.wrapper: IntentWrapper?
    get() = this?.let { IntentWrapperAndroid(it) }
