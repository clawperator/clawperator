package clawperator.operator.agent

import clawperator.task.runner.NodeMatcher
import clawperator.task.runner.TaskRetry
import clawperator.task.runner.TaskRetryPresets
import clawperator.task.runner.TaskScrollDirection
import clawperator.task.runner.UiAction
import clawperator.task.runner.UiSystemKey
import clawperator.task.runner.UiTextValidator
import clawperator.uitree.UiTreeClickTypes
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.longOrNull
import kotlin.time.Duration.Companion.milliseconds

interface AgentCommandParser {
    fun parse(payload: String): Result<AgentCommand>
}

class AgentCommandParserDefault : AgentCommandParser {
    companion object {
        private const val DEFAULT_TIMEOUT_MS = 30_000L
        private const val MIN_TIMEOUT_MS = 1_000L
        private const val MAX_TIMEOUT_MS = 120_000L
        private const val MAX_PAYLOAD_BYTES = 64_000
        private const val MAX_ACTIONS = 64
        private const val MAX_ID_LENGTH = 128
        private const val MAX_SOURCE_LENGTH = 64
        private const val MAX_MATCHER_VALUE_LENGTH = 512
        private const val MAX_URI_LENGTH = 2048

        private val json = Json {
            ignoreUnknownKeys = true
        }
    }

    override fun parse(payload: String): Result<AgentCommand> =
        runCatching {
            require(payload.isNotBlank()) { "payload is required" }
            require(payload.encodeToByteArray().size <= MAX_PAYLOAD_BYTES) {
                "payload exceeds $MAX_PAYLOAD_BYTES bytes"
            }

            val root = json.parseToJsonElement(payload).jsonObject

            val commandId = root.stringRequired("commandId", MAX_ID_LENGTH)
            val taskId = root.stringRequired("taskId", MAX_ID_LENGTH)
            val source = root.stringRequired("source", MAX_SOURCE_LENGTH)

            val timeoutMs =
                root.longOrNull("timeoutMs")
                    ?.coerceIn(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
                    ?: DEFAULT_TIMEOUT_MS

            val actionsArray = root["actions"]?.jsonArray ?: error("actions is required")
            require(actionsArray.isNotEmpty()) { "actions must not be empty" }
            require(actionsArray.size <= MAX_ACTIONS) { "actions exceeds max size of $MAX_ACTIONS" }

            val actions =
                actionsArray.mapIndexed { index, element ->
                    parseAction(index = index, actionJson = element.jsonObject)
                }

            AgentCommand(
                commandId = commandId,
                taskId = taskId,
                source = source,
                timeoutMs = timeoutMs,
                actions = actions,
            )
        }

    private fun parseAction(
        index: Int,
        actionJson: JsonObject,
    ): UiAction {
        val id = actionJson.stringRequired("id", MAX_ID_LENGTH)
        val type = actionJson.stringRequired("type", 64)
        val params: JsonObject = actionJson["params"]?.jsonObject ?: JsonObject(emptyMap())

        return when (type.lowercase()) {
            "open_uri" ->
                UiAction.OpenUri(
                    id = id,
                    uri = params.stringRequired("uri", MAX_URI_LENGTH),
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetryPresets.AppLaunch),
                )
            "open_app" ->
                UiAction.OpenApp(
                    id = id,
                    applicationId = params.stringRequired("applicationId", MAX_MATCHER_VALUE_LENGTH),
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetryPresets.AppLaunch),
                )
            "close_app" ->
                UiAction.CloseApp(
                    id = id,
                    applicationId = params.stringRequired("applicationId", MAX_MATCHER_VALUE_LENGTH),
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetryPresets.AppClose),
                )
            "wait_for_node", "find_node" ->
                UiAction.WaitForNode(
                    id = id,
                    matcher = params.parseMatcherRequired("matcher"),
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetryPresets.UiReadiness),
                )
            "click" ->
                UiAction.Click(
                    id = id,
                    matcher = params.parseMatcherRequired("matcher"),
                    clickTypes = params.parseClickTypes(),
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetryPresets.UiReadiness),
                )
            "scroll_and_click" ->
                UiAction.ScrollAndClick(
                    id = id,
                    target = params.parseMatcherRequired("target"),
                    container = params.parseMatcherOrNull("container"),
                    clickTypes = params.parseClickTypes(),
                    direction = params.parseDirection(),
                    maxSwipes = params.intOrDefault("maxSwipes", 10).coerceIn(1, 50),
                    distanceRatio = params.doubleOrDefault("distanceRatio", 0.7).toFloat().coerceIn(0f, 1f),
                    settleDelayMs = params.longOrDefault("settleDelayMs", 250L).coerceIn(0L, 10_000L),
                    scrollRetry = params.parseRetryOrDefault(key = "scrollRetry", defaultRetry = TaskRetryPresets.UiScroll),
                    clickRetry = params.parseRetryOrDefault(key = "clickRetry", defaultRetry = TaskRetryPresets.UiReadiness),
                    findFirstScrollableChild = params.booleanOrDefault("findFirstScrollableChild", true),
                    clickAfter = params.booleanOrDefault("clickAfter", true),
                )
            "scroll" ->
                UiAction.Scroll(
                    id = id,
                    container = params.parseMatcherOrNull("container"),
                    direction = params.parseDirection(),
                    distanceRatio = params.doubleOrDefault("distanceRatio", 0.7).toFloat().coerceIn(0f, 1f),
                    settleDelayMs = params.longOrDefault("settleDelayMs", 250L).coerceIn(0L, 10_000L),
                    findFirstScrollableChild = params.booleanOrDefault("findFirstScrollableChild", true),
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetry.None),
                )
            "scroll_until" ->
                UiAction.ScrollUntil(
                    id = id,
                    target = params.parseMatcherOrNull("target"),
                    container = params.parseMatcherOrNull("container"),
                    clickTypes = params.parseClickTypes(),
                    direction = params.parseDirection(),
                    distanceRatio = params.doubleOrDefault("distanceRatio", 0.7).toFloat().coerceIn(0f, 1f),
                    settleDelayMs = params.longOrDefault("settleDelayMs", 250L).coerceIn(0L, 10_000L),
                    maxScrolls = params.intOrDefault("maxScrolls", 20).coerceIn(1, 200),
                    maxDurationMs = params.longOrDefault("maxDurationMs", 10_000L).coerceIn(0L, 120_000L),
                    noPositionChangeThreshold = params.intOrDefault("noPositionChangeThreshold", 3).coerceIn(1, 20),
                    findFirstScrollableChild = params.booleanOrDefault("findFirstScrollableChild", true),
                    clickAfter = params.booleanOrDefault("clickAfter", false),
                )
            "read_text" ->
                UiAction.ReadText(
                    id = id,
                    matcher = params.parseMatcherRequired("matcher"),
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetryPresets.UiReadiness),
                    validator = params.parseValidator(),
                )
            "enter_text", "type_text" ->
                UiAction.EnterText(
                    id = id,
                    matcher = params.parseMatcherRequired("matcher"),
                    text = params.stringRequired("text", MAX_MATCHER_VALUE_LENGTH),
                    submit = params.booleanOrDefault("submit", false),
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetryPresets.UiReadiness),
                )
            "snapshot_ui" ->
                UiAction.SnapshotUi(
                    id = id,
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetryPresets.UiReadiness),
                )
            "take_screenshot" ->
                UiAction.TakeScreenshot(
                    id = id,
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetry.None),
                )
            "doctor_ping" ->
                UiAction.DoctorPing(
                    id = id,
                )
            "press_key", "key_press" ->
                UiAction.PressKey(
                    id = id,
                    key = UiSystemKey.fromWire(params.stringRequired("key", 32)),
                )
            "sleep" ->
                UiAction.Sleep(
                    id = id,
                    durationMs = params.longOrDefault("durationMs", 0L).coerceIn(0L, 120_000L),
                    retry = params.parseRetryOrDefault(defaultRetry = TaskRetry.None),
                )
            else -> error("unsupported action type at index=$index: $type")
        }
    }

    private fun JsonObject.parseValidator(): UiTextValidator? {
        val raw = this.stringOrNull("validator") ?: return null
        return when (raw.lowercase()) {
            "temperature" -> UiTextValidator.Temperature
            else -> error("unsupported validator: $raw")
        }
    }

    private fun JsonObject.parseDirection(): TaskScrollDirection {
        val raw = this.stringOrNull("direction") ?: return TaskScrollDirection.Down
        return when (raw.lowercase()) {
            "down" -> TaskScrollDirection.Down
            "up" -> TaskScrollDirection.Up
            "left" -> TaskScrollDirection.Left
            "right" -> TaskScrollDirection.Right
            else -> error("unsupported direction: $raw")
        }
    }

    private fun JsonObject.parseClickTypes(): UiTreeClickTypes {
        val raw = this.stringOrNull("clickType") ?: return UiTreeClickTypes.Default
        return when (raw.lowercase()) {
            "default", "click" -> UiTreeClickTypes.Click
            "long_click", "longclick" -> UiTreeClickTypes.LongClick
            "focus" -> UiTreeClickTypes.Focus
            else -> error("unsupported clickType: $raw")
        }
    }

    private fun JsonObject.parseRetryOrDefault(
        key: String? = null,
        defaultRetry: TaskRetry,
    ): TaskRetry {
        val retryObject =
            when (key) {
                null -> this["retry"]?.jsonObject
                else -> this[key]?.jsonObject
            } ?: return defaultRetry

        val maxAttempts = retryObject.intOrDefault("maxAttempts", 1).coerceIn(1, 10)
        val initialDelayMs = retryObject.longOrDefault("initialDelayMs", 0L).coerceIn(0L, 30_000L)
        val maxDelayMs = retryObject.longOrDefault("maxDelayMs", initialDelayMs).coerceIn(initialDelayMs, 60_000L)
        val backoffMultiplier = retryObject.doubleOrDefault("backoffMultiplier", 1.0).coerceIn(1.0, 5.0)
        val jitterRatio = retryObject.doubleOrDefault("jitterRatio", 0.0).coerceIn(0.0, 1.0)

        return TaskRetry(
            maxAttempts = maxAttempts,
            initialDelay = initialDelayMs.milliseconds,
            maxDelay = maxDelayMs.milliseconds,
            backoffMultiplier = backoffMultiplier,
            jitterRatio = jitterRatio,
        )
    }

    private fun JsonObject.parseMatcherRequired(key: String): NodeMatcher =
        parseMatcherOrNull(key) ?: error("$key is required")

    private fun JsonObject.parseMatcherOrNull(key: String): NodeMatcher? {
        val matcherObject = this[key]?.jsonObject ?: return null

        val resourceId = matcherObject.stringOrNullWithMax("resourceId", MAX_MATCHER_VALUE_LENGTH)
        val role = matcherObject.stringOrNullWithMax("role", MAX_MATCHER_VALUE_LENGTH)
        val textEquals = matcherObject.stringOrNullWithMax("textEquals", MAX_MATCHER_VALUE_LENGTH)
        val textContains = matcherObject.stringOrNullWithMax("textContains", MAX_MATCHER_VALUE_LENGTH)
        val contentDescEquals = matcherObject.stringOrNullWithMax("contentDescEquals", MAX_MATCHER_VALUE_LENGTH)
        val contentDescContains = matcherObject.stringOrNullWithMax("contentDescContains", MAX_MATCHER_VALUE_LENGTH)

        require(
            resourceId != null || role != null || textEquals != null || textContains != null ||
                contentDescEquals != null || contentDescContains != null,
        ) { "$key must include at least one matcher field" }

        return NodeMatcher(
            resourceId = resourceId,
            role = role,
            textEquals = textEquals,
            textContains = textContains,
            contentDescEquals = contentDescEquals,
            contentDescContains = contentDescContains,
        )
    }

    private fun JsonObject.stringRequired(
        key: String,
        maxLen: Int,
    ): String {
        val value = stringOrNull(key) ?: error("$key is required")
        require(value.isNotBlank()) { "$key must not be blank" }
        require(value.length <= maxLen) { "$key exceeds max length of $maxLen" }
        return value
    }

    private fun JsonObject.stringOrNull(key: String): String? {
        val primitive = this[key] as? JsonPrimitive ?: return null
        return primitive.content
    }

    private fun JsonObject.stringOrNullWithMax(key: String, maxLen: Int): String? {
        val value = stringOrNull(key) ?: return null
        require(value.length <= maxLen) { "$key exceeds max length of $maxLen" }
        return value
    }

    private fun JsonObject.intOrDefault(
        key: String,
        default: Int,
    ): Int = intOrNull(key) ?: default

    private fun JsonObject.intOrNull(key: String): Int? = (this[key] as? JsonPrimitive)?.intOrNull

    private fun JsonObject.longOrDefault(
        key: String,
        default: Long,
    ): Long = longOrNull(key) ?: default

    private fun JsonObject.longOrNull(key: String): Long? = (this[key] as? JsonPrimitive)?.longOrNull

    private fun JsonObject.doubleOrDefault(
        key: String,
        default: Double,
    ): Double = doubleOrNull(key) ?: default

    private fun JsonObject.doubleOrNull(key: String): Double? = (this[key] as? JsonPrimitive)?.doubleOrNull

    private fun JsonObject.booleanOrDefault(
        key: String,
        default: Boolean,
    ): Boolean = booleanOrNull(key) ?: default

    private fun JsonObject.booleanOrNull(key: String): Boolean? = (this[key] as? JsonPrimitive)?.booleanOrNull
}
