package action.livedata

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.switchMap

fun <T : Any> LiveData<T>.requireValue(): T = requireNotNull(value)

typealias LiveDataOneTimeAssignBlock<T> = () -> T

/**
 * Helper function to improve legibility of LiveData declarations for items that require to
 * set a value just once.
 *
 * Instead of this:
 *    private val _title = MutableLiveData<String>().apply {
 *        value = "My init value"
 *    }
 *    val title: LiveData<String>
 *        get() = _title
 *
 * You can use this:
 *    val title = liveData { "My init value" }
 *
 * Note that this is only for use with variables that will set a value just once.
 * It is not suitable for variables that change, such as those that are populated
 * based on the result of a UseCase invocation.
 */
inline fun <reified T : Any> liveData(value: LiveDataOneTimeAssignBlock<T>): LiveData<T> =
    MutableLiveData<T>().apply {
        this.value = value()
    }

typealias LiveDataAssignBlock<T> = () -> T

/**
 * Helper function to improve legibility of MutableLiveData declarations.
 *
 * Instead of this:
 *    private val _title = MutableLiveData<String>().apply {
 *        value = "My init value"
 *    }
 *
 * You can use this:
 *    private val _title = mutableLiveData { "My init value" }
 */
inline fun <reified T : Any> mutableLiveData(value: LiveDataAssignBlock<T>): MutableLiveData<T> =
    MutableLiveData<T>().apply {
        this.value = value()
    }

fun <T> LiveData<T?>.filterNotNull(): LiveData<T> {
    val mutableLiveData = MutableLiveData<T>()
    return switchMap { value ->
        if (value != null) {
            mutableLiveData.value = value
        }
        mutableLiveData
    }
}

fun LiveData<Boolean>?.isTrue(): Boolean = this?.value == true

fun LiveData<Boolean>?.isFalse(): Boolean = this?.value == false
