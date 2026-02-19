package action.coroutine

import kotlinx.coroutines.Dispatchers
import kotlin.coroutines.CoroutineContext

object CoroutineContextProviderAndroid : CoroutineContextProvider {
    override val main: CoroutineContext by lazy { Dispatchers.Main }
    override val io: CoroutineContext by lazy { Dispatchers.IO }
}
