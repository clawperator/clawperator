package action.utils

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Resources
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.view.View
import androidx.annotation.ColorRes
import androidx.arch.core.executor.ArchTaskExecutor
import androidx.core.content.res.ResourcesCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import java.io.BufferedReader
import java.io.File
import java.io.InputStream
import java.io.InputStreamReader
import java.io.PrintWriter
import java.io.StringWriter
import java.util.Random
import androidx.lifecycle.map as lifecycleMap
import androidx.lifecycle.switchMap as lifecycleSwitchMap

/**
 * Implementation of lazy that is not thread safe. Useful when you know what thread you will be
 * executing on and are not worried about synchronization.
 */
fun <T> lazyFast(operation: () -> T): Lazy<T> =
    lazy(LazyThreadSafetyMode.NONE) {
        operation()
    }

fun View.getColor(
    @ColorRes color: Int,
    theme: Resources.Theme? = null,
): Int = ResourcesCompat.getColor(resources, color, theme)

inline fun <reified VM : ViewModel> Fragment.activityViewModelProvider(
    provider: ViewModelProvider.Factory,
) = ViewModelProvider(this, provider)[VM::class.java]

inline fun <reified VM : ViewModel> Fragment.parentViewModelProvider(
    provider: ViewModelProvider.Factory,
) = ViewModelProvider(this, provider)[VM::class.java]

/** Uses `Transformations.map` on a LiveData */
fun <X, Y> LiveData<X>.map(body: (X) -> Y): LiveData<Y> = lifecycleMap(body)

/** Uses `Transformations.switchMap` on a LiveData */
fun <X, Y> LiveData<X>.switchMap(body: (X) -> LiveData<Y>): LiveData<Y> = lifecycleSwitchMap(body)

fun <T> MutableLiveData<T>.setValueIfNew(newValue: T?) {
    if (this.value != newValue) value = newValue
}

fun <T> MutableLiveData<T>.postValueIfNew(newValue: T) {
    if (this.value != newValue) postValue(newValue)
}

/**
 * Handles thread safety. Calls [setValueIfNew] when on the main
 * thread and [postValueIfNew] when not.
 */
fun <T> MutableLiveData<T>.updateValueIfNew(newValue: T) {
    if (ArchTaskExecutor.getInstance().isMainThread) {
        setValueIfNew(newValue)
    } else {
        postValueIfNew(newValue)
    }
}

fun <T> MutableLiveData<T>.updateValue(newValue: T) {
    if (ArchTaskExecutor.getInstance().isMainThread) {
        setValue(newValue)
    } else {
        postValue(newValue)
    }
}

fun Bundle.getAll(): Map<String, Any?>? {
    val results = mutableMapOf<String, Any?>()
    for (key in keySet()) {
        results[key] = getString(key)
    }
    return results.ifEmpty {
        null
    }
}

fun <T> List<T>.random(random: Random): T? = if (size > 0) get(random.nextInt(size)) else null

fun File.deleteDir() {
    listFiles()?.forEach { it.deleteDir() }
    delete()
}

fun File.deleteAllContents() {
    listFiles()?.forEach { it.deleteDir() }
}

fun File.makeDirIfItDoesNotExist(): File =
    apply {
        if (isDirectory && !exists()) {
            mkdir()
        }
    }

fun InputStream.toFile(path: String) {
    use { input ->
        File(path).outputStream().use { input.copyTo(it) }
    }
}

inline fun <reified K, V> Map<K, V>.toLinkedHashMap(): LinkedHashMap<K, V> = LinkedHashMap<K, V>(this)

inline fun <reified K, V> Iterable<Pair<K, V>>.toLinkedHashMap(): LinkedHashMap<K, V> = toMap().toLinkedHashMap()

fun Exception.stackTraceAsString(): String {
    val stringWriter = StringWriter()
    val printWriter = PrintWriter(stringWriter)
    printStackTrace(printWriter)
    return stringWriter.toString()
}

fun InputStream.asString(): String {
    val stringBuilder = StringBuilder()
    with(BufferedReader(InputStreamReader(this))) {
        var line = readLine()
        while (line != null) {
            stringBuilder.append(line)
            line = readLine()
            if (line != null) {
                stringBuilder.append("\n")
            }
        }
        close()
    }
    return stringBuilder.toString()
}

fun Context.registerReceiverEx(
    receiver: BroadcastReceiver?,
    intentFilter: IntentFilter,
): Intent? = registerReceiverEx(receiver, intentFilter, null, null)

fun Context.registerReceiverEx(
    receiver: BroadcastReceiver?,
    intentFilter: IntentFilter?,
    broadcastPermission: String?,
    scheduler: Handler?,
): Intent? =
    if (Build.VERSION.SDK_INT >= 33) {
        registerReceiver(
            receiver,
            intentFilter,
            broadcastPermission,
            scheduler,
            Context.RECEIVER_NOT_EXPORTED,
        )
    } else {
        registerReceiver(
            receiver,
            intentFilter,
            broadcastPermission,
            scheduler,
        )
    }
