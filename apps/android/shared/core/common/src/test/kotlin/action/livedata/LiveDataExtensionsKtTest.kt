package action.livedata

import androidx.lifecycle.MutableLiveData
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LiveDataExtensionsKtTest {
    @Test fun `LiveData Boolean isTrue()`() {
        assertTrue(MutableLiveData(true).isTrue())
        assertFalse(MutableLiveData(false).isTrue())
        val nullLiveData: MutableLiveData<Boolean>? = null
        assertFalse(nullLiveData.isTrue())
    }

    @Test fun `LiveData Boolean isFalse()`() {
        assertTrue(MutableLiveData(false).isFalse())
        assertFalse(MutableLiveData(true).isFalse())
        val nullLiveData: MutableLiveData<Boolean>? = null
        assertFalse(nullLiveData.isFalse())
    }
}
