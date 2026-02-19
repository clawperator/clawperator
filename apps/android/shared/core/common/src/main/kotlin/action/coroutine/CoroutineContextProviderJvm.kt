package action.coroutine

import kotlinx.coroutines.Dispatchers
import kotlin.coroutines.CoroutineContext

object CoroutineContextProviderJvm : CoroutineContextProvider {
    override val main: CoroutineContext by lazy { Dispatchers.Default }
    override val io: CoroutineContext by lazy { Dispatchers.Default }
}
