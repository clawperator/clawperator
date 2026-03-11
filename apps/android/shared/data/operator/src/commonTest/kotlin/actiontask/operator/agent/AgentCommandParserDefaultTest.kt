package clawperator.operator.agent

import clawperator.task.runner.UiAction
import clawperator.task.runner.TaskRetry
import clawperator.task.runner.TaskRetryPresets
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class AgentCommandParserDefaultTest {
    private val parser = AgentCommandParserDefault()

    @Test
    fun `parse valid payload with typed actions`() {
        val payload =
            """
            {
              "commandId": "cmd-123",
              "taskId": "task-123",
              "source": "debug",
              "timeoutMs": 45000,
              "actions": [
                {
                  "id": "step-1",
                  "type": "open_app",
                  "params": { "applicationId": "com.theswitchbot.switchbot" }
                },
                {
                  "id": "step-2",
                  "type": "read_text",
                  "params": {
                    "matcher": { "resourceId": "com.theswitchbot.switchbot:id/tvTemp" },
                    "validator": "temperature"
                  }
                },
                {
                  "id": "step-3",
                  "type": "snapshot_ui"
                }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isSuccess)

        val command = result.getOrThrow()
        assertEquals("cmd-123", command.commandId)
        assertEquals("task-123", command.taskId)
        assertEquals("debug", command.source)
        assertEquals(45_000L, command.timeoutMs)
        assertEquals(3, command.actions.size)

        assertIs<UiAction.OpenApp>(command.actions[0])
        assertIs<UiAction.ReadText>(command.actions[1])
        assertIs<UiAction.SnapshotUi>(command.actions[2])

        val open = command.actions[0] as UiAction.OpenApp
        val read = command.actions[1] as UiAction.ReadText
        val snapshot = command.actions[2] as UiAction.SnapshotUi
        assertEquals(TaskRetryPresets.AppLaunch, open.retry)
        assertEquals(TaskRetryPresets.UiReadiness, read.retry)
        assertEquals(TaskRetryPresets.UiReadiness, snapshot.retry)
    }

    @Test
    fun `parse rejects missing commandId`() {
        val payload =
            """
            {
              "taskId": "task-123",
              "source": "debug",
              "actions": [
                { "id": "step-1", "type": "snapshot_ui", "params": {} }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isFailure)
    }

    @Test
    fun `parse rejects unsupported action type`() {
        val payload =
            """
            {
              "commandId": "cmd-123",
              "taskId": "task-123",
              "source": "debug",
              "actions": [
                { "id": "step-1", "type": "delete_everything", "params": {} }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isFailure)
    }

    @Test
    fun `parse clamps timeout into allowed bounds`() {
        val payload =
            """
            {
              "commandId": "cmd-123",
              "taskId": "task-123",
              "source": "debug",
              "timeoutMs": 99999999,
              "actions": [
                { "id": "step-1", "type": "snapshot_ui", "params": {} }
              ]
            }
            """.trimIndent()

        val command = parser.parse(payload).getOrThrow()
        assertEquals(120_000L, command.timeoutMs)
    }

    @Test
    fun `parse valid open_uri action with market scheme`() {
        val payload =
            """
            {
              "commandId": "cmd-uri-1",
              "taskId": "task-uri-1",
              "source": "debug",
              "actions": [
                {
                  "id": "nav1",
                  "type": "open_uri",
                  "params": { "uri": "market://details?id=org.videolan.vlc" }
                }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isSuccess)

        val action = result.getOrThrow().actions[0]
        assertIs<UiAction.OpenUri>(action)

        val openUri = action as UiAction.OpenUri
        assertEquals("nav1", openUri.id)
        assertEquals("market://details?id=org.videolan.vlc", openUri.uri)
        assertEquals(TaskRetryPresets.AppLaunch, openUri.retry)
    }

    @Test
    fun `parse valid open_uri action with https scheme`() {
        val payload =
            """
            {
              "commandId": "cmd-uri-2",
              "taskId": "task-uri-2",
              "source": "debug",
              "actions": [
                {
                  "id": "nav2",
                  "type": "open_uri",
                  "params": { "uri": "https://example.com/page" }
                }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isSuccess)

        val openUri = result.getOrThrow().actions[0] as UiAction.OpenUri
        assertEquals("https://example.com/page", openUri.uri)
    }

    @Test
    fun `parse open_uri rejects missing uri param`() {
        val payload =
            """
            {
              "commandId": "cmd-uri-3",
              "taskId": "task-uri-3",
              "source": "debug",
              "actions": [
                {
                  "id": "nav3",
                  "type": "open_uri",
                  "params": {}
                }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isFailure)
    }

    @Test
    fun `parse open_uri rejects blank uri`() {
        val payload =
            """
            {
              "commandId": "cmd-uri-4",
              "taskId": "task-uri-4",
              "source": "debug",
              "actions": [
                {
                  "id": "nav4",
                  "type": "open_uri",
                  "params": { "uri": "   " }
                }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isFailure)
    }
}
