package action.random

import kotlin.random.Random

class RandomManagerDefault : RandomManager {
    private val staticSeed = 0xCAFEBABE
    private var refreshCount = 0

    override val deterministicRandom: Random
        get() = Random(staticSeed + refreshCount)

    override fun refresh() {
        refreshCount++
    }
}
