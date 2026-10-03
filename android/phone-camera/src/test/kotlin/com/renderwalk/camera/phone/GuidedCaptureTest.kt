package com.renderwalk.camera.phone

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.FileOutputStream

class GuidedCaptureTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    @Test
    fun testStandard8PointsGeneration() {
        val points = GuidedHeadingCalculator.generateStandard8Points()
        assertEquals(8, points.size)

        val expectedHeadings = listOf(0.0f, 45.0f, 90.0f, 135.0f, 180.0f, 225.0f, 270.0f, 315.0f)
        for (i in 0 until 8) {
            assertEquals(i + 1, points[i].index)
            assertEquals(expectedHeadings[i], points[i].targetHeadingDegrees, 0.01f)
            assertEquals(CapturePointState.NOT_ALIGNED, points[i].state)
            assertNull(points[i].capturedPhoto)
        }
    }

    @Test
    fun testAngleWraparoundShortestDifference() {
        // 359° to 1° should be +2° (turn right 2°)
        val diff1 = GuidedHeadingCalculator.calculateHeadingDelta(359.0f, 1.0f)
        assertEquals(2.0f, diff1, 0.01f)

        // 1° to 359° should be -2° (turn left 2°)
        val diff2 = GuidedHeadingCalculator.calculateHeadingDelta(1.0f, 359.0f)
        assertEquals(-2.0f, diff2, 0.01f)

        // 10° to 20° should be +10°
        val diff3 = GuidedHeadingCalculator.calculateHeadingDelta(10.0f, 20.0f)
        assertEquals(10.0f, diff3, 0.01f)

        // 20° to 10° should be -10°
        val diff4 = GuidedHeadingCalculator.calculateHeadingDelta(20.0f, 10.0f)
        assertEquals(-10.0f, diff4, 0.01f)

        // Across 180° line: 10° to 190° -> 180°
        val diff5 = GuidedHeadingCalculator.calculateHeadingDelta(10.0f, 190.0f)
        assertEquals(180.0f, Math.abs(diff5), 0.01f)
    }

    @Test
    fun testAlignmentEvaluationWithTolerance() {
        val tolerance = 8.0f

        // Within tolerance: target 45°, current 47° (+2° delta) -> ALIGNED
        val eval1 = GuidedHeadingCalculator.evaluate(47.0f, 45.0f, tolerance)
        assertEquals(CapturePointState.ALIGNED, eval1.state)
        assertEquals("ALIGNED", eval1.directionText)
        assertTrue(eval1.isGuidanceAvailable)

        // Beyond tolerance right: target 45°, current 10° (+35° delta) -> TURN RIGHT
        val eval2 = GuidedHeadingCalculator.evaluate(10.0f, 45.0f, tolerance)
        assertEquals(CapturePointState.NOT_ALIGNED, eval2.state)
        assertEquals("TURN RIGHT", eval2.directionText)

        // Beyond tolerance left: target 45°, current 80° (-35° delta) -> TURN LEFT
        val eval3 = GuidedHeadingCalculator.evaluate(80.0f, 45.0f, tolerance)
        assertEquals(CapturePointState.NOT_ALIGNED, eval3.state)
        assertEquals("TURN LEFT", eval3.directionText)
    }

    @Test
    fun testUnavailableSensorHeadingEvaluation() {
        val eval = GuidedHeadingCalculator.evaluate(null, 90.0f)
        assertEquals(CapturePointState.NOT_ALIGNED, eval.state)
        assertFalse(eval.isGuidanceAvailable)
        assertEquals("Orientation guidance unavailable", eval.directionText)
    }

    @Test
    fun testGuidedCaptureManagerProgressionAndRetake() {
        val manager = GuidedCaptureManager(alignmentToleranceDeg = 8.0f)
        assertEquals(8, manager.totalPoints)
        assertEquals(0, manager.currentIndex)
        assertEquals(1, manager.currentPoint.index)

        // Point 1 is at 0°: update heading to 15° (misaligned, delta -15°)
        manager.onHeadingUpdated(15.0f)
        assertFalse(manager.currentEvaluation.state == CapturePointState.ALIGNED)
        assertEquals("TURN LEFT", manager.currentEvaluation.directionText)

        // Align phone to 2° (within +/- 8° tolerance)
        manager.onHeadingUpdated(2.0f)
        assertTrue(manager.currentEvaluation.state == CapturePointState.ALIGNED)
        assertEquals("ALIGNED", manager.currentEvaluation.directionText)

        // Simulate successful photo capture on Point 1
        val dummyFile = tempFolder.newFile("photo_1.jpg")
        FileOutputStream(dummyFile).use { it.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte())) }
        val photo1 = CapturedPhoto(
            file = dummyFile,
            uri = android.net.Uri.EMPTY,
            width = 1920,
            height = 1080,
            fileSizeBytes = dummyFile.length(),
            captureTimestamp = System.currentTimeMillis(),
            facing = CameraLensFacing.BACK
        )

        manager.currentPoint.capturedPhoto = photo1
        manager.currentPoint.state = CapturePointState.CAPTURED
        assertEquals(1, manager.capturedCount)

        // Retake resets point 1 and deletes file
        manager.retakeCurrentOrPreviousPoint()
        assertEquals(0, manager.capturedCount)
        assertNull(manager.currentPoint.capturedPhoto)
        assertEquals(CapturePointState.NOT_ALIGNED, manager.currentPoint.state)
        assertFalse(dummyFile.exists()) // File cleanly deleted
    }

    @Test
    fun testCompletionSummaryTruthfulContract() {
        val manager = GuidedCaptureManager()

        // Populate all 8 points with simulated local captures
        for (i in 0 until 8) {
            val file = tempFolder.newFile("photo_${i}.jpg")
            val photo = CapturedPhoto(
                file = file,
                uri = android.net.Uri.EMPTY,
                width = 1920,
                height = 1080,
                fileSizeBytes = 1000L,
                captureTimestamp = System.currentTimeMillis(),
                facing = CameraLensFacing.BACK
            )
            manager.points[i].capturedPhoto = photo
            manager.points[i].state = CapturePointState.CAPTURED
        }

        val session = manager.getSessionSummary()
        assertEquals(8, session.points.size)
        assertEquals("8 captured images ready for stitching", session.completionSummary)
        assertFalse(session.completionSummary.contains("360 panorama created"))
        assertFalse(session.completionSummary.contains("360 camera"))
    }
}
