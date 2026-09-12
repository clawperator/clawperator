package clawperator.operator.agent

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
}
