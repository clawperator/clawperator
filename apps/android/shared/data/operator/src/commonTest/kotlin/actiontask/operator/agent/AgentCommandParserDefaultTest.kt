package clawperator.operator.agent

import clawperator.task.runner.UiAction
import clawperator.task.runner.UiSystemKey
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
    fun `parse start and stop recording actions`() {
        val payload =
            """
            {
              "commandId": "cmd-record-1",
              "taskId": "task-record-1",
              "source": "debug",
              "actions": [
                {
                  "id": "start-1",
                  "type": "start_recording",
                  "params": { "sessionId": "demo-001" }
                },
                {
                  "id": "stop-1",
                  "type": "stop_recording",
                  "params": {}
                }
              ]
            }
            """.trimIndent()

        val command = parser.parse(payload).getOrThrow()
        assertEquals(2, command.actions.size)

        assertIs<UiAction.StartRecording>(command.actions[0])
        assertIs<UiAction.StopRecording>(command.actions[1])
        val start = command.actions[0] as UiAction.StartRecording
        val stop = command.actions[1] as UiAction.StopRecording
        assertEquals("demo-001", start.sessionId)
        assertEquals(null, stop.sessionId)
    }

    @Test
    fun `parse rejects blank recording session id`() {
        val payload =
            """
            {
              "commandId": "cmd-record-2",
              "taskId": "task-record-2",
              "source": "debug",
              "actions": [
                {
                  "id": "start-1",
                  "type": "start_recording",
                  "params": { "sessionId": "   " }
                }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isFailure)
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
                  "params": { "uri": "market://details?id=com.actionlauncher.playstore" }
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
        assertEquals("market://details?id=com.actionlauncher.playstore", openUri.uri)
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

    @Test
    fun `parse press_key back`() {
        val payload =
            """
            {
              "commandId": "cmd-key-1",
              "taskId": "task-key-1",
              "source": "debug",
              "actions": [
                { "id": "k1", "type": "press_key", "params": { "key": "back" } }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isSuccess)

        val action = result.getOrThrow().actions[0]
        assertIs<UiAction.PressKey>(action)
        assertEquals(UiSystemKey.BACK, (action as UiAction.PressKey).key)
    }

    @Test
    fun `parse press_key home`() {
        val payload =
            """
            {
              "commandId": "cmd-key-2",
              "taskId": "task-key-2",
              "source": "debug",
              "actions": [
                { "id": "k2", "type": "press_key", "params": { "key": "home" } }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isSuccess)
        val action = result.getOrThrow().actions[0] as UiAction.PressKey
        assertEquals(UiSystemKey.HOME, action.key)
    }

    @Test
    fun `parse press_key recents`() {
        val payload =
            """
            {
              "commandId": "cmd-key-3",
              "taskId": "task-key-3",
              "source": "debug",
              "actions": [
                { "id": "k3", "type": "press_key", "params": { "key": "recents" } }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isSuccess)
        val action = result.getOrThrow().actions[0] as UiAction.PressKey
        assertEquals(UiSystemKey.RECENTS, action.key)
    }

    @Test
    fun `parse press_key rejects unsupported key`() {
        val payload =
            """
            {
              "commandId": "cmd-key-4",
              "taskId": "task-key-4",
              "source": "debug",
              "actions": [
                { "id": "k4", "type": "press_key", "params": { "key": "volume_up" } }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isFailure)
    }

    @Test
    fun `parse press_key accepts key_press alias`() {
        val payload =
            """
            {
              "commandId": "cmd-key-5",
              "taskId": "task-key-5",
              "source": "debug",
              "actions": [
                { "id": "k5", "type": "key_press", "params": { "key": "back" } }
              ]
            }
            """.trimIndent()

        val result = parser.parse(payload)
        assertTrue(result.isSuccess)
        val action = result.getOrThrow().actions[0] as UiAction.PressKey
        assertEquals(UiSystemKey.BACK, action.key)
    }
}
