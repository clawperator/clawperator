/**
 * Copyright 2019 Hadi Lashkari Ghouchani

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package action.livedata

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import androidx.lifecycle.Observer
import org.junit.Before
import org.junit.Rule
import org.junit.rules.TestRule
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private class RecordingObserver<T> : Observer<T> {
    val values = mutableListOf<T>()
    override fun onChanged(value: T) { values.add(value) }
}

class LiveEventTest {
    @get:Rule var rule: TestRule = InstantTaskExecutorRule()

    private lateinit var liveEvent: LiveEvent<String>
    private lateinit var owner: TestLifecycleOwner
    private lateinit var observer: RecordingObserver<String>

    @Before
    fun setup() {
        liveEvent = LiveEvent()
        owner = TestLifecycleOwner()
        observer = RecordingObserver()
    }

    @Test
    fun observe() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)
    }

    @Test
    fun `observe multi observers`() {
        // Given
        owner.start()
        val observer1 = RecordingObserver<String>()
        liveEvent.observe(owner, observer)
        liveEvent.observe(owner, observer1)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)
        assertEquals(listOf(event), observer1.values)
    }

    @Test
    fun `observe after start`() {
        // Given
        owner.create()
        liveEvent.observe(owner, observer)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertTrue(observer.values.isEmpty())

        // When
        owner.start()

        // Then
        assertEquals(listOf(event), observer.values)
    }

    @Test
    fun `observe after start with multi observers`() {
        // Given
        owner.create()
        val observer1 = RecordingObserver<String>()
        liveEvent.observe(owner, observer)
        liveEvent.observe(owner, observer1)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertTrue(observer.values.isEmpty())
        assertTrue(observer1.values.isEmpty())

        // When
        owner.start()

        // Then
        assertEquals(listOf(event), observer.values)
        assertEquals(listOf(event), observer1.values)
    }

    @Test
    fun `observe after stop`() {
        // Given
        owner.stop()
        liveEvent.observe(owner, observer)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertTrue(observer.values.isEmpty())
    }

    @Test
    fun `observe after start again`() {
        // Given
        owner.stop()
        liveEvent.observe(owner, observer)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertTrue(observer.values.isEmpty())

        // When
        owner.start()

        // Then
        assertEquals(listOf(event), observer.values)
    }

    @Test
    fun `observe after one observation`() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)

        // When
        owner.stop()

        // Then
        assertEquals(listOf(event), observer.values)

        // When
        owner.start()

        // Then
        assertEquals(listOf(event), observer.values)
    }

    @Test
    fun `observe after one observation multi owner`() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)
        val owner1 = TestLifecycleOwner()
        val observer1 = RecordingObserver<String>()
        owner1.start()

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)

        // Given
        liveEvent.observe(owner1, observer1)

        // Then
        assertTrue(observer1.values.isEmpty())

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event, event), observer.values)
        assertEquals(listOf(event), observer1.values)
    }

    @Test
    fun `observe after one observation with new owner`() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)

        // When
        owner.destroy()

        // Then
        assertEquals(listOf(event), observer.values)

        // When
        owner = TestLifecycleOwner()
        observer = RecordingObserver()
        liveEvent.observe(owner, observer)
        owner.start()

        // Then
        assertTrue(observer.values.isEmpty())
    }

    @Test
    fun `observe after one observation with new owner after start`() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)

        // When
        owner.destroy()

        // Then
        assertEquals(listOf(event), observer.values)

        // When
        owner = TestLifecycleOwner()
        observer = RecordingObserver()
        owner.start()
        liveEvent.observe(owner, observer)

        // Then
        assertTrue(observer.values.isEmpty())
    }

    @Test
    fun `observe after remove`() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)

        // When
        liveEvent.removeObserver(observer)
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)
    }

    @Test
    fun `observe after remove before emit`() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)
        liveEvent.removeObserver(observer)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertTrue(observer.values.isEmpty())
    }

    @Test
    fun `observe after remove owner`() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)

        // When
        liveEvent.removeObservers(owner)
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)
    }

    @Test
    fun `observe after remove owner before emit`() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)
        liveEvent.removeObservers(owner)

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertTrue(observer.values.isEmpty())
    }

    @Test
    fun `observe after remove multi owner`() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)
        val owner1 = TestLifecycleOwner()
        val observer1 = RecordingObserver<String>()
        owner1.start()

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)
        assertTrue(observer1.values.isEmpty())

        // When
        liveEvent.observe(owner1, observer1)
        liveEvent.removeObserver(observer)
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)
        assertEquals(listOf(event), observer1.values)
    }

    @Test
    fun `observe after remove owner multi owner`() {
        // Given
        owner.start()
        liveEvent.observe(owner, observer)
        val owner1 = TestLifecycleOwner()
        val observer1 = RecordingObserver<String>()
        owner1.start()

        val event = "event"

        // When
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)
        assertTrue(observer1.values.isEmpty())

        // When
        liveEvent.observe(owner1, observer1)
        liveEvent.removeObservers(owner)
        liveEvent.value = event

        // Then
        assertEquals(listOf(event), observer.values)
        assertEquals(listOf(event), observer1.values)
    }
}
