package clawperator.task.runner

import action.system.model.ApplicationId
import kotlin.time.Duration

interface TaskScope {
    suspend fun openApp(
        applicationId: ApplicationId,
        retry: TaskRetry = TaskRetry.None,
    )

    suspend fun pause(
        duration: Duration,
        retry: TaskRetry = TaskRetry.None,
    )

    suspend fun logUiTree(retry: TaskRetry = TaskRetry.None)

    /**
     * Closes (backgrounds) the specified app by simulating a swipe-up gesture.
     * First ensures the app is in the foreground, then performs the gesture to go home.
     *
     * @param applicationId The application ID to close
     * @param retry Retry configuration (defaults to TaskRetry.None, implementations may use TaskRetryPresets.AppClose)
     * @throws Exception if the app cannot be closed after all retry attempts
     */
    suspend fun closeApp(
        applicationId: ApplicationId,
        retry: TaskRetry = TaskRetry.None,
    )

    /**
     * Executes UI inspection and interaction operations within a TaskUiScope.
     * Provides access to UI elements for reading values and performing actions.
     *
     * @param block The UI operations to perform, optionally returning a value
     * @return The value returned by the block, or Unit if no value is returned
     */
    suspend fun <T> ui(block: suspend TaskUiScope.() -> T): T
}
