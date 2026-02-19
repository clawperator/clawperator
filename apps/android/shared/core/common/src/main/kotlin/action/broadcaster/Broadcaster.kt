package action.broadcaster

import android.content.Intent

interface Broadcaster {
    fun sendBroadcast(intent: Intent)
}

class BroadcasterStub : Broadcaster {
    override fun sendBroadcast(intent: Intent) { }
}
