package clawperator.operator.agent

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.security.MessageDigest
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ResultEnvelopeTransportTest {
    @Test
    fun `query failure emits canonical failed envelope with retained steps and stable code`() {
        val result = clawperator.task.runner.UiActionExecutionResult(
            commandId = "command",
            taskId = "task",
            stepResults = listOf(
                clawperator.task.runner.UiActionStepResult("before", "query_ui", data = mapOf("query" to "{}")),
                clawperator.task.runner.UiActionStepResult("missing", "query_ui", success = false, data = mapOf("errorCode" to "UI_TREE_UNAVAILABLE")),
            ),
            errorCode = "UI_TREE_UNAVAILABLE",
            error = "Hierarchy unavailable",
        )
        val line = buildCanonicalSuccessLine("command", "task", result)
        val envelope = Json.decodeFromString<ClawperatorResultEnvelope>(line.substringAfter("$CLAWPERATOR_RESULT_PREFIX "))
        assertEquals("failed", envelope.status)
        assertEquals(result.commandId, envelope.commandId)
        assertEquals(result.taskId, envelope.taskId)
        assertEquals(result.errorCode, envelope.errorCode)
        assertEquals(result.error, envelope.error)
        assertEquals(listOf("before", "missing"), envelope.stepResults.map { it.id })
    }

    @Test
    fun `small canonical results remain unchanged`() {
        val line = buildCanonicalFailureLine("command", "task", "not available")
        assertEquals(listOf(line), resultEnvelopeLogLines(line, "command", "task"))
    }

    @Test
    fun `large Unicode results fit logcat records and reassemble without byte loss`() {
        val commandId = "界".repeat(128)
        val taskId = "\n".repeat(128)
        val canonical = buildCanonicalFailureLine(commandId, taskId, "界😀".repeat(40000))
        val lines = resultEnvelopeLogLines(canonical, commandId, taskId)
        assertTrue(lines.size > 100)
        val bytes = java.io.ByteArrayOutputStream()
        lines.forEachIndexed { index, line ->
            assertTrue(line.encodeToByteArray().size < 3000)
            val chunk = Json.parseToJsonElement(line.substringAfter("[Clawperator-Result-Chunk] ")).jsonObject
            assertEquals(commandId, chunk.getValue("commandId").jsonPrimitive.content)
            assertEquals(taskId, chunk.getValue("taskId").jsonPrimitive.content)
            assertEquals(index, chunk.getValue("index").jsonPrimitive.int)
            assertEquals(lines.size, chunk.getValue("count").jsonPrimitive.int)
            assertEquals(canonical.encodeToByteArray().size, chunk.getValue("byteLength").jsonPrimitive.int)
            bytes.write(Base64.getDecoder().decode(chunk.getValue("data").jsonPrimitive.content))
        }
        assertEquals(canonical, bytes.toByteArray().decodeToString())
        val expectedHash = MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray()).joinToString("") { "%02x".format(it) }
        assertEquals(
            expectedHash,
            Json
                .parseToJsonElement(lines.last().substringAfter("[Clawperator-Result-Chunk] "))
                .jsonObject
                .getValue("sha256")
                .jsonPrimitive.content,
        )
    }
    @Test
    fun `publication spaces large records without replay or reordering`() = runBlocking {
        val line = "x".repeat(70000)
        val expected = resultEnvelopeLogLines(line, "command", "task")
        val events = mutableListOf<String>()
        publishResultEnvelope(line, "command", "task", { events += it }, { events += "pause" })
        assertEquals(expected, events.filter { it != "pause" })
        assertEquals(expected.size - 1, events.count { it == "pause" })
        events.forEachIndexed { index, event ->
            if (index % 2 == 1) assertEquals("pause", event)
        }
        events.clear()
        publishResultEnvelope("small", "command", "task", { events += it }, { events += "pause" })
        assertEquals(listOf("small"), events)
    }

    @Test
    fun `publication frees the caller thread and finishes after cancellation`() = runBlocking {
        val callerThread = Thread.currentThread()
        val paused = CompletableDeferred<Unit>()
        val resumePublication = CompletableDeferred<Unit>()
        val lines = mutableListOf<String>()
        val canonical = "x".repeat(70000)
        val publisher = launch {
            publishResultEnvelope(canonical, "command", "task", {
                assertTrue(Thread.currentThread() !== callerThread)
                lines += it
            }, {
                paused.complete(Unit)
                resumePublication.await()
            })
        }
        withTimeout(5000) {
            paused.await()
            // This coroutine shares the caller thread with publisher. It must be
            // able to run while publication is waiting between records.
            publisher.cancel()
            resumePublication.complete(Unit)
            publisher.join()
        }
        assertEquals(resultEnvelopeLogLines(canonical, "command", "task"), lines)
    }

    @Test
    fun `already cancelled command still publishes every terminal record`() = runBlocking {
        val canonical = "x".repeat(70000)
        val lines = mutableListOf<String>()
        val publisher = launch {
            cancel()
            publishResultEnvelope(canonical, "command", "task", { lines += it }, {})
        }
        publisher.join()
        assertEquals(resultEnvelopeLogLines(canonical, "command", "task"), lines)
    }
}
