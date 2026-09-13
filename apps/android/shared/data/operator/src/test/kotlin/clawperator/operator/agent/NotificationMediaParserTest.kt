package clawperator.operator.agent

import clawperator.task.runner.UiAction
import clawperator.task.runner.isBackgroundObservation
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NotificationMediaParserTest {
    private fun parse(actions: String) = AgentCommandParserDefault().parse("""{"commandId":"test","taskId":"test","source":"test","timeoutMs":1000,"actions":[$actions]}""")
    @Test fun onlyCanonicalReadsBypassUiRequirements() {
        val read = """{"id":"a","type":"list_notifications"}"""
        assertTrue(parse(read).getOrThrow().actions.isBackgroundObservation())
        assertFalse(parse("""$read,{"id":"b","type":"sleep","params":{"durationMs":1}}""").getOrThrow().actions.isBackgroundObservation())
        assertFalse(parse("""{"id":"b","type":"sleep","params":{"durationMs":1}},$read""").getOrThrow().actions.isBackgroundObservation())
        assertTrue(parse("""{"id":"a","type":"LIST_NOTIFICATIONS"}""").isFailure)
    }
    @Test fun rejectsMissingBlankConflictingAndInvalidParams() {
        for (params in listOf("{}", """{"mediaSessionId":""}""", """{"applicationId":" "}""", """{"applicationId":"p","mediaSessionId":"s"}""", """{"mediaSessionId":42}""")) {
            assertTrue(parse("""{"id":"a","type":"get_media_status","params":$params}""").isFailure)
        }
        assertTrue(parse("""{"id":"a","type":"list_notifications","params":{"limit":101}}""").isFailure)
        assertTrue(parse("""{"id":"a","type":"list_notifications","params":{"limit":"1"}}""").isFailure)
        assertTrue(parse("""{"id":"a","type":"media_play","params":{"mediaSessionId":"s","waitTimeoutMs":30001}}""").isFailure)
    }
}
