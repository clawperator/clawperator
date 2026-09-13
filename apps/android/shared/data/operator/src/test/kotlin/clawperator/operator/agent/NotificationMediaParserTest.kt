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
    @Test fun newMutationsAreStrictAndNeverBackgroundReads() {
        for ((type, params) in listOf(
            "dismiss_notification" to """{"notificationKey":"key"}""",
            "invoke_notification_action" to """{"notificationKey":"key","actionId":"revision:0"}""",
            "media_seek" to """{"mediaSessionId":"s","positionMs":0,"positionToleranceMs":0}""",
        )) {
            val mutation = """{"id":"b","type":"$type","params":$params}"""
            val read = """{"id":"a","type":"list_notifications"}"""
            for (actions in listOf(mutation, "$read,$mutation", "$mutation,$read")) {
                assertFalse(parse(actions).getOrThrow().actions.isBackgroundObservation())
            }
        }
        for (position in listOf("-1", "1.5", "9007199254740992", "null", "\"1\"")) {
            assertTrue(parse("""{"id":"a","type":"media_seek","params":{"mediaSessionId":"s","positionMs":$position}}""").isFailure)
        }
        for ((type, params) in listOf(
            "media_seek" to """{"mediaSessionId":"s"}""",
            "media_seek" to """{"mediaSessionId":"s","positionMs":0,"positionToleranceMs":60001}""",
            "dismiss_notification" to "{}",
            "dismiss_notification" to """{"notificationKey":" "}""",
            "invoke_notification_action" to """{"notificationKey":"k","actionId":"a","waitTimeoutMs":1}""",
        )) assertTrue(parse("""{"id":"a","type":"$type","params":$params}""").isFailure)
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
