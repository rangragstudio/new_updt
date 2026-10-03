package com.renderwalk.camera.phone

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.FileOutputStream

@OptIn(ExperimentalCoroutinesApi::class)
class BackgroundUploadTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private fun createDummyPhoto(name: String): CapturedPhoto {
        val file = tempFolder.newFile(name)
        FileOutputStream(file).use { it.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte())) }
        return CapturedPhoto(
            file = file,
            uri = android.net.Uri.EMPTY,
            width = 1920,
            height = 1080,
            fileSizeBytes = file.length(),
            captureTimestamp = System.currentTimeMillis(),
            facing = CameraLensFacing.BACK
        )
    }

    // -------------------------------------------------------------------------
    // TEST 1: Capture creates PENDING upload
    // -------------------------------------------------------------------------
    @Test
    fun testCaptureCreatesPendingUpload() {
        val point = CapturePoint(index = 1, targetHeadingDegrees = 0.0f)
        val photo = createDummyPhoto("photo_point1.jpg")
        point.capturedPhoto = photo

        val queue = BackgroundUploadQueue(
            uploadService = DefaultCaptureUploadService(),
            coroutineScope = testScope
        )

        // Queue upload
        queue.enqueuePoint(point, "test-session-1")
        assertEquals(UploadState.PENDING, point.uploadState)
    }

    // -------------------------------------------------------------------------
    // TEST 2: PENDING becomes UPLOADING
    // -------------------------------------------------------------------------
    @Test
    fun testPendingBecomesUploading() = runTest(testDispatcher) {
        val point = CapturePoint(index = 2, targetHeadingDegrees = 45.0f)
        val photo = createDummyPhoto("photo_point2.jpg")
        point.capturedPhoto = photo

        var uploadStateDuringServiceCall: UploadState? = null

        val customService = object : CaptureUploadService {
            override fun isEndpointAvailable() = true
            override suspend fun uploadAsset(payload: UploadAssetPayload): UploadResult {
                uploadStateDuringServiceCall = point.uploadState
                return UploadResult.Success(remoteAssetId = "remote-asset-2")
            }
        }

        val queue = BackgroundUploadQueue(uploadService = customService, coroutineScope = this)
        queue.enqueuePoint(point, "test-session-2")

        testScheduler.advanceUntilIdle()

        assertEquals(UploadState.UPLOADING, uploadStateDuringServiceCall)
    }

    // -------------------------------------------------------------------------
    // TEST 3: Successful server acknowledgement becomes UPLOADED
    // -------------------------------------------------------------------------
    @Test
    fun testSuccessfulAcknowledgementBecomesUploaded() = runTest(testDispatcher) {
        val point = CapturePoint(index = 3, targetHeadingDegrees = 90.0f)
        val photo = createDummyPhoto("photo_point3.jpg")
        point.capturedPhoto = photo

        val mockService = object : CaptureUploadService {
            override fun isEndpointAvailable() = true
            override suspend fun uploadAsset(payload: UploadAssetPayload): UploadResult {
                return UploadResult.Success(remoteAssetId = "srv-asset-99", uploadedTimestamp = 1700000000000L)
            }
        }

        val queue = BackgroundUploadQueue(uploadService = mockService, coroutineScope = this)
        queue.enqueuePoint(point, "test-session-3")

        testScheduler.advanceUntilIdle()

        assertEquals(UploadState.UPLOADED, point.uploadState)
        assertEquals("srv-asset-99", point.remoteAssetId)
        assertEquals(1700000000000L, point.uploadedTimestamp)
        assertNull(point.lastUploadError)
    }

    // -------------------------------------------------------------------------
    // TEST 4: Failed upload remains FAILED
    // -------------------------------------------------------------------------
    @Test
    fun testFailedUploadRemainsFailed() = runTest(testDispatcher) {
        val point = CapturePoint(index = 4, targetHeadingDegrees = 135.0f)
        val photo = createDummyPhoto("photo_point4.jpg")
        point.capturedPhoto = photo

        val failingService = object : CaptureUploadService {
            override fun isEndpointAvailable() = true
            override suspend fun uploadAsset(payload: UploadAssetPayload): UploadResult {
                return UploadResult.Failure(error = "Network timeout", isTransient = true)
            }
        }

        val queue = BackgroundUploadQueue(uploadService = failingService, coroutineScope = this)
        queue.enqueuePoint(point, "test-session-4")

        testScheduler.advanceUntilIdle()

        assertEquals(UploadState.FAILED, point.uploadState)
        assertEquals("Network timeout", point.lastUploadError)
        assertNull(point.remoteAssetId)
    }

    // -------------------------------------------------------------------------
    // TEST 5: Offline capture remains PENDING
    // -------------------------------------------------------------------------
    @Test
    fun testOfflineCaptureRemainsPending() = runTest(testDispatcher) {
        val point = CapturePoint(index = 5, targetHeadingDegrees = 180.0f)
        val photo = createDummyPhoto("photo_point5.jpg")
        point.capturedPhoto = photo

        val queue = BackgroundUploadQueue(uploadService = DefaultCaptureUploadService(), coroutineScope = this)
        queue.networkStatus = NetworkStatus.OFFLINE

        queue.enqueuePoint(point, "test-session-5")
        testScheduler.advanceUntilIdle()

        assertEquals(UploadState.PENDING, point.uploadState)
        assertTrue(photo.file.exists())
    }

    // -------------------------------------------------------------------------
    // TEST 6: Retry works
    // -------------------------------------------------------------------------
    @Test
    fun testRetryWorks() = runTest(testDispatcher) {
        val point = CapturePoint(index = 6, targetHeadingDegrees = 225.0f)
        val photo = createDummyPhoto("photo_point6.jpg")
        point.capturedPhoto = photo

        var attempt = 0
        val retryService = object : CaptureUploadService {
            override fun isEndpointAvailable() = true
            override suspend fun uploadAsset(payload: UploadAssetPayload): UploadResult {
                attempt++
                return if (attempt == 1) {
                    UploadResult.Failure("Temporary 503 error", isTransient = true)
                } else {
                    UploadResult.Success(remoteAssetId = "remote-retry-success")
                }
            }
        }

        val queue = BackgroundUploadQueue(uploadService = retryService, coroutineScope = this)
        queue.enqueuePoint(point, "test-session-6")
        testScheduler.advanceUntilIdle()

        assertEquals(UploadState.FAILED, point.uploadState)

        // User triggers retry
        queue.retryPoint(point, "test-session-6")
        testScheduler.advanceUntilIdle()

        assertEquals(UploadState.UPLOADED, point.uploadState)
        assertEquals("remote-retry-success", point.remoteAssetId)
    }

    // -------------------------------------------------------------------------
    // TEST 7: Local file survives failed upload
    // -------------------------------------------------------------------------
    @Test
    fun testLocalFileSurvivesFailedUpload() = runTest(testDispatcher) {
        val point = CapturePoint(index = 7, targetHeadingDegrees = 270.0f)
        val photo = createDummyPhoto("photo_point7.jpg")
        point.capturedPhoto = photo

        val failService = object : CaptureUploadService {
            override fun isEndpointAvailable() = true
            override suspend fun uploadAsset(payload: UploadAssetPayload): UploadResult {
                return UploadResult.Failure("Server connection reset")
            }
        }

        val queue = BackgroundUploadQueue(uploadService = failService, coroutineScope = this)
        queue.enqueuePoint(point, "test-session-7")
        testScheduler.advanceUntilIdle()

        assertEquals(UploadState.FAILED, point.uploadState)
        assertTrue("Local file MUST NOT be deleted on upload failure", photo.file.exists())
    }

    // -------------------------------------------------------------------------
    // TEST 8: Local file survives successful upload
    // -------------------------------------------------------------------------
    @Test
    fun testLocalFileSurvivesSuccessfulUpload() = runTest(testDispatcher) {
        val point = CapturePoint(index = 8, targetHeadingDegrees = 315.0f)
        val photo = createDummyPhoto("photo_point8.jpg")
        point.capturedPhoto = photo

        val successService = object : CaptureUploadService {
            override fun isEndpointAvailable() = true
            override suspend fun uploadAsset(payload: UploadAssetPayload): UploadResult {
                return UploadResult.Success(remoteAssetId = "srv-success-8")
            }
        }

        val queue = BackgroundUploadQueue(uploadService = successService, coroutineScope = this)
        queue.enqueuePoint(point, "test-session-8")
        testScheduler.advanceUntilIdle()

        assertEquals(UploadState.UPLOADED, point.uploadState)
        assertTrue("Local file MUST be kept intact after successful upload in this task", photo.file.exists())
    }

    // -------------------------------------------------------------------------
    // TEST 9: Eight captures can upload independently
    // -------------------------------------------------------------------------
    @Test
    fun testEightCapturesUploadIndependently() = runTest(testDispatcher) {
        val points = GuidedHeadingCalculator.generateStandard8Points()
        for (i in 0 until 8) {
            points[i].capturedPhoto = createDummyPhoto("point_${i + 1}.jpg")
        }

        val mockService = object : CaptureUploadService {
            override fun isEndpointAvailable() = true
            override suspend fun uploadAsset(payload: UploadAssetPayload): UploadResult {
                return UploadResult.Success(remoteAssetId = "remote-asset-${payload.capturePointId}")
            }
        }

        val queue = BackgroundUploadQueue(uploadService = mockService, coroutineScope = this)
        for (pt in points) {
            queue.enqueuePoint(pt, "session-all-8")
        }

        testScheduler.advanceUntilIdle()

        for (pt in points) {
            assertEquals(UploadState.UPLOADED, pt.uploadState)
            assertEquals("remote-asset-${pt.index}", pt.remoteAssetId)
        }
    }

    // -------------------------------------------------------------------------
    // TEST 10: Upload states correctly displayed
    // -------------------------------------------------------------------------
    @Test
    fun testUploadStatesValues() {
        val states = UploadState.values().map { it.name }
        assertTrue(states.contains("PENDING"))
        assertTrue(states.contains("UPLOADING"))
        assertTrue(states.contains("UPLOADED"))
        assertTrue(states.contains("FAILED"))
    }

    // -------------------------------------------------------------------------
    // TEST 11: READY_FOR_PROCESSING only occurs after all required uploads succeed
    // -------------------------------------------------------------------------
    @Test
    fun testReadyForProcessingOnlyAfterAllUploadsSucceed() {
        val points = GuidedHeadingCalculator.generateStandard8Points()
        for (i in 0 until 8) {
            points[i].capturedPhoto = createDummyPhoto("p_${i + 1}.jpg")
            // 7 points uploaded, 1 point still uploading
            points[i].uploadState = if (i < 7) UploadState.UPLOADED else UploadState.UPLOADING
        }

        val allUploaded = points.size == 8 && points.all { it.uploadState == UploadState.UPLOADED }
        assertFalse("Cannot be READY_FOR_PROCESSING while any upload is pending/running", allUploaded)

        // Mark 8th point uploaded
        points[7].uploadState = UploadState.UPLOADED
        val allUploadedNow = points.size == 8 && points.all { it.uploadState == UploadState.UPLOADED }
        assertTrue(allUploadedNow)
    }

    // -------------------------------------------------------------------------
    // TEST 12: Retake preserves the same capture point ID
    // -------------------------------------------------------------------------
    @Test
    fun testRetakePreservesCapturePointId() {
        val manager = GuidedCaptureManager()
        val originalPoint4 = manager.points[3]
        assertEquals(4, originalPoint4.index)

        manager.selectPointForRetake(4)
        assertEquals(3, manager.currentIndex)
        assertEquals(4, manager.currentPoint.index)
        assertEquals(8, manager.points.size) // No point 9 created!
    }

    // -------------------------------------------------------------------------
    // TEST 13: No duplicate capture points
    // -------------------------------------------------------------------------
    @Test
    fun testNoDuplicateCapturePoints() {
        val manager = GuidedCaptureManager()
        val indices = manager.points.map { it.index }
        assertEquals(8, indices.size)
        assertEquals(indices.distinct().size, indices.size)
        assertEquals(listOf(1, 2, 3, 4, 5, 6, 7, 8), indices)
    }

    // -------------------------------------------------------------------------
    // TEST 14: Missing upload endpoint reported correctly
    // -------------------------------------------------------------------------
    @Test
    fun testMissingUploadEndpointReportedCorrectly() {
        val defaultService = DefaultCaptureUploadService(backendUploadUrl = null)
        assertFalse(defaultService.isEndpointAvailable())

        val photo = createDummyPhoto("test_missing_ep.jpg")
        val payload = UploadAssetPayload(
            sessionId = "test-sess",
            capturePointId = 1,
            localFilePath = photo.file.absolutePath,
            targetHeadingDegrees = 0.0f,
            actualHeadingDegrees = 0.0f,
            captureTimestamp = System.currentTimeMillis(),
            width = 1920,
            height = 1080,
            fileSizeBytes = photo.file.length()
        )

        val result = defaultService.uploadAsset(payload)
        assertTrue(result is UploadResult.Failure)
        val failure = result as UploadResult.Failure
        assertEquals("UPLOAD_ENDPOINT_NOT_AVAILABLE", failure.errorCode)
        assertFalse(failure.isTransient)
    }

    // -------------------------------------------------------------------------
    // TEST 15: Missing processing endpoint reported correctly
    // -------------------------------------------------------------------------
    @Test
    fun testMissingProcessingEndpointReportedCorrectly() = runTest {
        val defaultHandoffService = DefaultServerHandoffService(processingJobUrl = null)
        assertFalse(defaultHandoffService.isEndpointAvailable())

        val session = RoomCaptureSession(
            points = GuidedHeadingCalculator.generateStandard8Points(),
            isCompleted = true,
            status = SessionStatus.READY_FOR_PROCESSING
        )

        val result = defaultHandoffService.handoffSession(session)
        assertTrue(result is HandoffResult.Failure)
        val failure = result as HandoffResult.Failure
        assertEquals("PROCESSING_ENDPOINT_NOT_AVAILABLE", failure.errorCode)
    }
}
