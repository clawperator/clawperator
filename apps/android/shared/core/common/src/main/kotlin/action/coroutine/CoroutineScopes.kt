package action.coroutine

import kotlinx.coroutines.CoroutineScope

data class CoroutineScopes(
    val main: CoroutineScope,
    val io: CoroutineScope,
)
