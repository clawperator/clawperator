package clawperator.operator.agent

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.security.MessageDigest
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

/** Logcat cannot carry a large query envelope in one record. Reassemble before parsing the canonical envelope. */
@OptIn(ExperimentalEncodingApi::class)
fun resultEnvelopeLogLines(
    canonicalLine: String,
    commandId: String,
    taskId: String,
): List<String> {
    val bytes = canonicalLine.encodeToByteArray()
    if (bytes.size <= 3000) return listOf(canonicalLine)
    val chunkBytes = 1024
    val count = (bytes.size + chunkBytes - 1) / chunkBytes
    val sha256 = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    return (0 until count).map { index ->
        val data = Base64.encode(bytes.copyOfRange(index * chunkBytes, minOf((index + 1) * chunkBytes, bytes.size)))
        "[Clawperator-Result-Chunk] " + Json.encodeToString(ResultEnvelopeChunk(commandId, taskId, index, count, bytes.size, sha256, data))
    }
}

@Serializable
private data class ResultEnvelopeChunk(
    val commandId: String,
    val taskId: String,
    val index: Int,
    val count: Int,
    val byteLength: Int,
    val sha256: String,
    val data: String,
)
