package com.renderwalk.camera.phone

import kotlinx.coroutines.*
import java.io.File

/**
 * BackgroundUploadQueue
 * Decoupled background queue that executes incremental asset uploads asynchronously on Dispatchers.IO.
 * Ensures the camera UI never blocks while capturing subsequent points.
 * Retains original local JPEG files on both success and failure.
 */
class BackgroundUploadQueue(
    private val uploadService: CaptureUploadService = DefaultCaptureUploadService(),
    private val coroutineScope: CoroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
) {
    var networkStatus: NetworkStatus = NetworkStatus.ONLINE

    // Queue of pending point upload requests (thread-safe synchronization)
    private val activeJobs = mutableMapOf<Int, Job>()
    private val lock = Any()

    /**
     * Enqueues an asset for background upload.
     * Transitions state to PENDING and starts background worker if online.
     */
    fun enqueuePoint(
        point: CapturePoint,
        sessionId: String,
        onStatusChanged: (() -> Unit)? = null
    ) {
        synchronized(lock) {
            val photo = point.capturedPhoto
            if (photo == null || !photo.file.exists()) {
                point.uploadState = UploadState.FAILED
                point.lastUploadError = "Original capture is unavailable. Please recapture this point."
                onStatusChanged?.invoke()
                return
            }

            point.uploadState = UploadState.PENDING
            point.lastUploadError = null
            onStatusChanged?.invoke()

            if (networkStatus == NetworkStatus.OFFLINE) {
                // Kept safely in PENDING status ("Waiting for connection")
                return
            }

            val job = coroutineScope.launch {
                executeUpload(point, sessionId, onStatusChanged)
            }
            activeJobs[point.index] = job
        }
    }

    /**
     * Executes the upload for a specific point.
     */
    private suspend fun executeUpload(
        point: CapturePoint,
        sessionId: String,
        onStatusChanged: (() -> Unit)?
    ) {
        val photo = point.capturedPhoto
        if (photo == null || !photo.file.exists()) {
            point.uploadState = UploadState.FAILED
            point.lastUploadError = "Original capture is unavailable. Please recapture this point."
            onStatusChanged?.invoke()
            return
        }

        if (networkStatus == NetworkStatus.OFFLINE) {
            point.uploadState = UploadState.PENDING
            onStatusChanged?.invoke()
            return
        }

        // Transition: PENDING -> UPLOADING
        point.uploadState = UploadState.UPLOADING
        point.uploadAttemptCount++
        onStatusChanged?.invoke()

        val payload = UploadAssetPayload(
            sessionId = sessionId,
            capturePointId = point.index,
            localFilePath = photo.file.absolutePath,
            targetHeadingDegrees = point.targetHeadingDegrees,
            actualHeadingDegrees = point.actualHeadingDegrees ?: point.targetHeadingDegrees,
            captureTimestamp = point.captureTimestamp ?: photo.captureTimestamp,
            width = photo.width,
            height = photo.height,
            fileSizeBytes = photo.fileSizeBytes
        )

        val result = uploadService.uploadAsset(payload)

        synchronized(lock) {
            when (result) {
                is UploadResult.Success -> {
                    point.uploadState = UploadState.UPLOADED
                    point.remoteAssetId = result.remoteAssetId
                    point.uploadedTimestamp = result.uploadedTimestamp
                    point.lastUploadError = null
                    // Local file is deliberately KEPT intact (requirement 3)
                }

                is UploadResult.Failure -> {
                    point.uploadState = UploadState.FAILED
                    point.lastUploadError = result.error
                    // Local file survives failed upload (requirement 4 & 7)
                }
            }
            activeJobs.remove(point.index)
        }

        onStatusChanged?.invoke()
    }

    /**
     * Retries upload for a specific point index.
     */
    fun retryPoint(
        point: CapturePoint,
        sessionId: String,
        onStatusChanged: (() -> Unit)? = null
    ) {
        enqueuePoint(point, sessionId, onStatusChanged)
    }

    /**
     * Retries all failed uploads in the sequence.
     */
    fun retryAllFailed(
        points: List<CapturePoint>,
        sessionId: String,
        onStatusChanged: (() -> Unit)? = null
    ) {
        points.filter { it.uploadState == UploadState.FAILED }.forEach { point ->
            enqueuePoint(point, sessionId, onStatusChanged)
        }
    }

    /**
     * Notifies queue of network status changes (e.g. online recovery).
     */
    fun updateNetworkStatus(
        newStatus: NetworkStatus,
        points: List<CapturePoint>,
        sessionId: String,
        onStatusChanged: (() -> Unit)? = null
    ) {
        networkStatus = newStatus
        if (newStatus == NetworkStatus.ONLINE) {
            // Automatically process pending uploads
            points.filter { it.uploadState == UploadState.PENDING }.forEach { point ->
                enqueuePoint(point, sessionId, onStatusChanged)
            }
        }
    }

    /**
     * Cancels all pending or active upload jobs.
     */
    fun cancelAll() {
        synchronized(lock) {
            activeJobs.values.forEach { it.cancel() }
            activeJobs.clear()
        }
    }
}
