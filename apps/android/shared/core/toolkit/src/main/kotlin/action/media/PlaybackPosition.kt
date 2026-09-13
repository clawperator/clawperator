package action.media

/** Player reports and estimates share elapsedRealtime, never host wall time. */
data class PlaybackPosition(
    val reportedPositionMs: Long?,
    val estimatedPositionMs: Long?,
    val positionUpdatedElapsedMs: Long?,
    val positionUpdateAgeMs: Long?,
    val unknownReason: String?,
)

fun playbackPosition(position: Long?, updatedAt: Long?, observedAt: Long, speed: Float?, advancing: Boolean, duration: Long?): PlaybackPosition {
    val reported = position?.takeIf { it >= 0 }
    val updated = updatedAt?.takeIf { it > 0 && it <= observedAt }
    val age = updated?.let { observedAt - it }
    val reason = when {
        reported == null -> "position_unavailable"
        updated == null -> "position_update_time_unavailable"
        speed == null || !speed.isFinite() -> "playback_speed_unavailable"
        else -> null
    }
    val estimate = if (reason == null && reported != null && age != null && speed != null) {
        val value = (reported.toDouble() + if (advancing) age.toDouble() * speed else 0.0)
            .coerceAtLeast(0.0).coerceAtMost(Long.MAX_VALUE.toDouble()).toLong()
        duration?.takeIf { it >= 0 }?.let { value.coerceAtMost(it) } ?: value
    } else null
    return PlaybackPosition(reported, estimate, updatedAt?.takeIf { it > 0 }, age, reason)
}
