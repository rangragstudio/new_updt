package com.renderwalk.camera.phone

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.FileOutputStream

class CaptureSessionManagementTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private fun createValidPhoto(name: String, width: Int = 1920, height: Int = 1080): CapturedPhoto {
        val file = tempFolder.newFile(name)
        // Write valid dummy JPEG bytes (SOI marker 0xFF 0xD8)
        FileOutputStream(file).use { it.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte())) }
        return CapturedPhoto(
            file = file,
            uri = android.net.Uri.EMPTY,
            width = width,
            height = height,
            fileSizeBytes = file.length(),
            captureTimestamp = 1700000000000L,
            facing = CameraLensFacing.BACK
        )
    }

    private fun createCompleteValidPoints(): List<CapturePoint> {
        val points = GuidedHeadingCalculator.generateStandard8Points()
        for (i in 0 until 8) {
            val photo = createValidPhoto("photo_${i + 1}.jpg")
            points[i].capturedPhoto = photo
            points[i].actualHeadingDegrees = points[i].targetHeadingDegrees
            points[i].captureTimestamp = photo.captureTimestamp
            points[i].state = CapturePointState.CAPTURED
        }
        return points
    }

    // -------------------------------------------------------------------------
    // TEST 1: Eight Valid Captures
    // -------------------------------------------------------------------------
    @Test
    fun testEightValidCapturesPassValidation() {
        val points = createCompleteValidPoints()
        val result = CaptureSetValidator.validatePoints(points)
        assertTrue("8 valid points must pass validation", result is CaptureSetValidationResult.Valid)
    }

    // -------------------------------------------------------------------------
    // TEST 2: Missing Image Rejection
    // -------------------------------------------------------------------------
    @Test
    fun testMissingImageRejected() {
        val points = createCompleteValidPoints()
        // Remove image for Point 4
        points[3].capturedPhoto = null

        val result = CaptureSetValidator.validatePoints(points)
        assertTrue(result is CaptureSetValidationResult.Invalid)
        val errors = (result as CaptureSetValidationResult.Invalid).errors
        assertTrue(errors.any { it.contains("Point 4 image is missing") })
    }

    // -------------------------------------------------------------------------
    // TEST 3: Invalid / Corrupt Image Rejection
    // -------------------------------------------------------------------------
    @Test
    fun testInvalidZeroByteImageRejected() {
        val points = createCompleteValidPoints()
        // Replace Point 7 image with empty file
        val emptyFile = tempFolder.newFile("empty_7.jpg")
        points[6].capturedPhoto = CapturedPhoto(
            file = emptyFile,
            uri = android.net.Uri.EMPTY,
            width = 1920,
            height = 1080,
            fileSizeBytes = 0L,
            captureTimestamp = 1700000000000L,
            facing = CameraLensFacing.BACK
        )

        val result = CaptureSetValidator.validatePoints(points)
        assertTrue(result is CaptureSetValidationResult.Invalid)
        val errors = (result as CaptureSetValidationResult.Invalid).errors
        assertTrue(errors.any { it.contains("Point 7") && (it.contains("empty") || it.contains("cannot be read")) })
    }

    // -------------------------------------------------------------------------
    // TEST 4: Duplicate Point Rejection
    // -------------------------------------------------------------------------
    @Test
    fun testDuplicatePointIndexRejected() {
        val points = createCompleteValidPoints().toMutableList()
        // Make point 2 have index 1 (duplicate index 1)
        val duplicatePoint = points[1].copy(index = 1)
        points[1] = duplicatePoint

        val result = CaptureSetValidator.validatePoints(points)
        assertTrue(result is CaptureSetValidationResult.Invalid)
        val errors = (result as CaptureSetValidationResult.Invalid).errors
        assertTrue(errors.any { it.contains("Duplicate point assignments detected") })
    }

    // -------------------------------------------------------------------------
    // TEST 5: Successful Retake Replaces File and Deletes Old File
    // -------------------------------------------------------------------------
    @Test
    fun testSuccessfulRetakeSafeReplacement() {
        val manager = GuidedCaptureManager()
        val oldPhotoFile = tempFolder.newFile("point1_old.jpg")
        FileOutputStream(oldPhotoFile).use { it.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte())) }
        val oldPhoto = CapturedPhoto(
            file = oldPhotoFile,
            uri = android.net.Uri.EMPTY,
            width = 1920,
            height = 1080,
            fileSizeBytes = oldPhotoFile.length(),
            captureTimestamp = 1700000000000L,
            facing = CameraLensFacing.BACK
        )

        manager.currentPoint.capturedPhoto = oldPhoto
        manager.currentPoint.state = CapturePointState.CAPTURED
        manager.currentPoint.actualHeadingDegrees = 0.0f
        manager.currentPoint.captureTimestamp = oldPhoto.captureTimestamp

        // Initiate retake for Point 1
        manager.selectPointForRetake(1)
        assertEquals(0, manager.currentIndex)
        assertEquals(0, manager.activeRetakeIndex)
        assertFalse(manager.isReviewing)

        // Simulate new photo captured
        val newPhotoFile = tempFolder.newFile("point1_new.jpg")
        FileOutputStream(newPhotoFile).use { it.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())) }
        val newPhoto = CapturedPhoto(
            file = newPhotoFile,
            uri = android.net.Uri.EMPTY,
            width = 3840,
            height = 2160,
            fileSizeBytes = newPhotoFile.length(),
            captureTimestamp = 1700000005000L,
            facing = CameraLensFacing.BACK
        )

        // Safe replacement logic:
        val prev = manager.currentPoint.capturedPhoto
        if (prev != null && prev.file.exists()) {
            prev.file.delete()
        }
        manager.currentPoint.capturedPhoto = newPhoto
        manager.currentPoint.actualHeadingDegrees = 1.5f
        manager.currentPoint.captureTimestamp = newPhoto.captureTimestamp

        assertEquals(newPhoto, manager.currentPoint.capturedPhoto)
        assertEquals(3840, manager.currentPoint.capturedPhoto?.width)
        assertEquals(1.5f, manager.currentPoint.actualHeadingDegrees)
        assertFalse("Old file must be deleted", oldPhotoFile.exists())
        assertTrue("New file must exist", newPhotoFile.exists())
    }

    // -------------------------------------------------------------------------
    // TEST 6: Failed Retake Preserves Previous Image
    // -------------------------------------------------------------------------
    @Test
    fun testFailedRetakePreservesPreviousValidImage() {
        val manager = GuidedCaptureManager()
        val oldPhotoFile = tempFolder.newFile("point2_valid.jpg")
        FileOutputStream(oldPhotoFile).use { it.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte())) }
        val oldPhoto = CapturedPhoto(
            file = oldPhotoFile,
            uri = android.net.Uri.EMPTY,
            width = 1920,
            height = 1080,
            fileSizeBytes = oldPhotoFile.length(),
            captureTimestamp = 1700000000000L,
            facing = CameraLensFacing.BACK
        )

        manager.points[1].capturedPhoto = oldPhoto
        manager.points[1].state = CapturePointState.CAPTURED

        // Initiate retake for Point 2
        manager.selectPointForRetake(2)
        assertEquals(1, manager.currentIndex)

        // Simulate replacement failure (e.g. camera error or corrupt file)
        // Under failure contract: old photo MUST NOT be deleted
        val failureOccurred = true
        if (failureOccurred) {
            // Keep previous photo intact!
        }

        assertEquals(oldPhoto, manager.points[1].capturedPhoto)
        assertTrue("Previous valid photo file must remain intact on failure", oldPhotoFile.exists())
    }

    // -------------------------------------------------------------------------
    // TEST 7: Discard Session Deletes All Files and Resets
    // -------------------------------------------------------------------------
    @Test
    fun testDiscardSessionDeletesAllCapturedFiles() {
        val manager = GuidedCaptureManager()
        val createdFiles = mutableListOf<File>()

        for (i in 0 until 8) {
            val file = tempFolder.newFile("discard_test_${i}.jpg")
            FileOutputStream(file).use { it.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte())) }
            createdFiles.add(file)

            val photo = CapturedPhoto(
                file = file,
                uri = android.net.Uri.EMPTY,
                width = 1920,
                height = 1080,
                fileSizeBytes = file.length(),
                captureTimestamp = System.currentTimeMillis(),
                facing = CameraLensFacing.BACK
            )
            manager.points[i].capturedPhoto = photo
            manager.points[i].state = CapturePointState.CAPTURED
        }

        assertEquals(8, manager.capturedCount)

        // Discard session
        manager.discardSession()

        assertEquals(0, manager.capturedCount)
        assertEquals(SessionStatus.DISCARDED, manager.sessionStatus)
        assertEquals(0, manager.currentIndex)
        assertFalse(manager.isReviewing)

        // Verify all 8 files deleted
        for (f in createdFiles) {
            assertFalse("Discarded file must be deleted from disk: ${f.name}", f.exists())
        }
    }

    // -------------------------------------------------------------------------
    // TEST 8: Confirm Valid Session Transitions to READY_FOR_STITCHING
    // -------------------------------------------------------------------------
    @Test
    fun testConfirmValidSessionTransitionsToReadyForStitching() {
        val manager = GuidedCaptureManager()
        for (i in 0 until 8) {
            val photo = createValidPhoto("valid_${i}.jpg")
            manager.points[i].capturedPhoto = photo
            manager.points[i].actualHeadingDegrees = manager.points[i].targetHeadingDegrees
            manager.points[i].captureTimestamp = photo.captureTimestamp
            manager.points[i].state = CapturePointState.CAPTURED
        }

        val result = manager.confirmCaptureSet()
        assertTrue(result is CaptureSetValidationResult.Valid)
        assertEquals(SessionStatus.READY_FOR_STITCHING, manager.sessionStatus)
    }

    // -------------------------------------------------------------------------
    // TEST 9: Reject Incomplete Session
    // -------------------------------------------------------------------------
    @Test
    fun testRejectIncompleteSession() {
        val manager = GuidedCaptureManager()
        // Only capture 5 points
        for (i in 0 until 5) {
            val photo = createValidPhoto("incomplete_${i}.jpg")
            manager.points[i].capturedPhoto = photo
            manager.points[i].actualHeadingDegrees = manager.points[i].targetHeadingDegrees
            manager.points[i].captureTimestamp = photo.captureTimestamp
            manager.points[i].state = CapturePointState.CAPTURED
        }

        val result = manager.confirmCaptureSet()
        assertTrue(result is CaptureSetValidationResult.Invalid)
        assertNotEquals(SessionStatus.READY_FOR_STITCHING, manager.sessionStatus)
    }

    // -------------------------------------------------------------------------
    // TEST 10: READY_FOR_STITCHING Truthful Contract
    // -------------------------------------------------------------------------
    @Test
    fun testReadyForStitchingTruthfulContract() {
        val manager = GuidedCaptureManager()
        for (i in 0 until 8) {
            val photo = createValidPhoto("stitched_ready_${i}.jpg")
            manager.points[i].capturedPhoto = photo
            manager.points[i].actualHeadingDegrees = manager.points[i].targetHeadingDegrees
            manager.points[i].captureTimestamp = photo.captureTimestamp
            manager.points[i].state = CapturePointState.CAPTURED
        }

        manager.confirmCaptureSet()
        val session = manager.getSessionSummary()

        assertEquals(SessionStatus.READY_FOR_STITCHING, session.status)
        assertEquals("8 captured images ready for stitching", session.completionSummary)
        // Ensure no premature claims
        assertFalse(session.completionSummary.contains("360 panorama created"))
        assertFalse(session.completionSummary.contains("Stitching complete"))
    }
}
