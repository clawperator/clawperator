package action.coroutine.flow

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

@OptIn(ExperimentalCoroutinesApi::class)
class FlowExtTest {
    @Test
    fun testEmptyFlow() =
        runTest {
            val result = emptyFlow<Int>().pairwise().toList()
            assertEquals(emptyList(), result)
        }

    @Test
    fun testSingleElementFlow() =
        runTest {
            val result = flowOf(42).pairwise().toList()
            assertEquals(emptyList(), result)
        }

    @Test
    fun testTwoElementFlow() =
        runTest {
            val result = flowOf(1, 2).pairwise().toList()
            assertEquals(listOf(1 to 2), result)
        }

    @Test
    fun testThreeElementFlow() =
        runTest {
            val result = flowOf(1, 2, 3).pairwise().toList()
            assertEquals(listOf(1 to 2, 2 to 3), result)
        }

    @Test
    fun testPairwiseWithNull() =
        runTest {
            val result = flowOf<Int?>(null, 1, null, 2).pairwise().toList()
            assertEquals(listOf(null to 1, 1 to null, null to 2), result)
        }

    @Test
    fun `hotIn replays last emission to late subscribers`() =
        runTest {
            val coldFlow =
                flow {
                    emit(1)
                    delay(10)
                    emit(2)
                }

            val shared = coldFlow.hotIn(backgroundScope, replay = 1)

            // first collector: should see both 1 and 2
            val collected1 = mutableListOf<Int>()
            val job1 = launch { shared.toList(collected1) }
            advanceTimeBy(20)
            job1.cancel()
            assertEquals(listOf(1, 2), collected1)

            // late collector: only the last value (2) is replayed
            val collected2 = mutableListOf<Int>()
            val job2 = launch { shared.take(1).toList(collected2) }
            advanceUntilIdle()
            assertEquals(listOf(2), collected2)
            job2.cancel()
        }

    @Test
    fun `hotIn shares a single upstream among multiple subscribers`() =
        runTest {
            val source = MutableSharedFlow<Int>()

            val shared = source.hotIn(backgroundScope, replay = 1)

            val resultsA = mutableListOf<Int>()
            val resultsB = mutableListOf<Int>()

            val jobA = launch { shared.take(2).toList(resultsA) }
            val jobB =
                launch {
                    delay(5)
                    shared.take(2).toList(resultsB)
                }
            advanceUntilIdle()

            source.emit(10)
            advanceTimeBy(10)
            source.emit(20)
            advanceTimeBy(10)

            jobA.cancel()
            jobB.cancel()

            assertEquals(listOf(10, 20), resultsA)
            assertEquals(listOf(10, 20), resultsB)
        }
}
