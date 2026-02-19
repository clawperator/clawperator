package action.random

import kotlin.random.Random

interface RandomManager {
    val deterministicRandom: Random

    fun refresh()
}
