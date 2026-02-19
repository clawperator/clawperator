package clawperator.operator.task

import action.log.Log
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.request.url
import io.ktor.http.ContentType
import io.ktor.http.contentType

class TaskStatusReporterDefault(
    private val httpClient: HttpClient,
    private val baseUrl: String = "https://clawperator.app.web.app", // Firebase Hosting URL
) : TaskStatusReporter {
    companion object {
        private const val TAG = "TaskStatusReporter"
    }

    override suspend fun reportStatus(
        taskId: String,
        deviceId: String,
        status: String,
        message: String,
        progressPct: Int?,
        result: String?,
        errorCode: String?,
    ): Result<Unit> {
        return try {
            val request =
                TaskStatusRequest(
                    taskId = taskId,
                    deviceId = deviceId,
                    status = status,
                    message = message,
                    progressPct = progressPct,
                    result = result,
                    errorCode = errorCode,
                )

            val response =
                httpClient.post {
                    url("$baseUrl/taskStatus")
                    contentType(ContentType.Application.Json)
                    setBody(request)
                }

            if (response.status.value != 200) {
                Log.w("$TAG Task status report failed with HTTP ${response.status.value}: $status - $message (taskId: $taskId)")
                return Result.failure(Exception("HTTP ${response.status.value}: ${response.status.description}"))
            }

            val responseBody = response.body<TaskStatusResponse>()
            Log.i("$TAG Task status reported: $status - $message (taskId: $taskId, response: ${responseBody.status} - ${responseBody.taskState?.message})")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("$TAG Failed to report task status: $status - $message (taskId: $taskId). Error: ${e.message}", e)
            Result.failure(e)
        }
    }
}
