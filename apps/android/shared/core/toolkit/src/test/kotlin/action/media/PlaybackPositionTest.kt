package action.media

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class PlaybackPositionTest {
    @Test fun stalePlayingReportRemainsDistinctFromEstimate() {
        val first = playbackPosition(1000, 5000, 6000, 2f, true, 10000)
        val later = playbackPosition(1000, 5000, 8000, 2f, true, 10000)
        assertEquals(1000L, later.reportedPositionMs)
        assertEquals(5000L, later.positionUpdatedElapsedMs)
        assertEquals(3000L, later.positionUpdateAgeMs)
        assertEquals(3000L, first.estimatedPositionMs)
        assertEquals(7000L, later.estimatedPositionMs)
    }
    @Test fun pausedBufferingUnknownAndClamped() {
        assertEquals(1000L, playbackPosition(1000, 5000, 9000, 1f, false, null).estimatedPositionMs)
        assertEquals(2000L, playbackPosition(1000, 5000, 9000, 1f, true, 2000).estimatedPositionMs)
        assertEquals(0L, playbackPosition(1000, 5000, 9000, -1f, true, null).estimatedPositionMs)
        assertNull(playbackPosition(-1, 5000, 9000, 1f, true, null).reportedPositionMs)
        assertNull(playbackPosition(1000, 0, 9000, 1f, true, null).estimatedPositionMs)
        assertNull(playbackPosition(1000, 10000, 9000, 1f, true, null).estimatedPositionMs)
        assertNull(playbackPosition(1000, 5000, 9000, Float.NaN, true, null).estimatedPositionMs)
    }
}
