package action.livedata

import androidx.annotation.WorkerThread
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

private val defaultExecutor: Executor by lazy { Executors.newFixedThreadPool(4) }

/**
 * Simple port of [androidx.lifecycle.ComputableLiveData]
 */
abstract class ComputableLiveData<T>(
    private val executor: Executor = defaultExecutor,
) {
    private val liveData: MutableLiveData<T>
    private val invalid = AtomicBoolean(true)
    private val computing = AtomicBoolean(false)
    private var value: T? = null

    init {
        liveData =
            object : MutableLiveData<T>() {
                override fun onActive() {
                    executor.execute(refreshRunnable)
                }
            }
    }

    /**
     * Returns A LiveData that is controlled by ComputableLiveData.
     */
    fun getLiveData(): LiveData<T> = liveData

    fun computeImmediate(): T {
        refreshRunnable.run()
        return value ?: throw NullPointerException("Failed to resolve value")
    }

    internal val refreshRunnable: Runnable =
        Runnable {
            // check invalid after releasing compute lock to avoid the following scenario.
            // Thread A runs compute()
            // Thread A checks invalid, it is false
            // Main thread sets invalid to true
            // Thread B runs, fails to acquire compute lock and skips
            // Thread A releases compute lock
            // We've left invalid in set state. The check below recovers.
            while (invalid.get()) {
                // compute can happen only in 1 thread but no reason to lock others.
                if (computing.compareAndSet(false, true)) {
                    // as long as it is invalid, keep computing.
                    try {
                        var computed = false
                        while (invalid.get()) {
                            computed = true
                            value = compute()
                            invalid.set(false)
                        }
                        if (computed) {
                            liveData.postValue(value)
                        }
                    } finally {
                        // release compute lock
                        computing.set(false)
                    }
                }
            }
        }

    @WorkerThread
    protected abstract fun compute(): T
}

class ComputableLiveDataImpl<T>(
    executor: Executor,
    private val computation: () -> T,
) : ComputableLiveData<T>(executor) {
    override fun compute() = computation()
}

fun <T> computableLiveData(
    executor: Executor = defaultExecutor,
    computation: () -> T,
): ComputableLiveData<T> = ComputableLiveDataImpl(executor, computation)
