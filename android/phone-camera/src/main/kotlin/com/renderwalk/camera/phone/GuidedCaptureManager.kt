package com.renderwalk.camera.phone

import androidx.compose.runtime.*
import java.util.UUID

/**
 * GuidedCaptureManager
 * Coordinates the 8-point room rotation sequence, evaluates real-time alignment against
 * target headings, controls real CameraX capture triggering, safe retakes with atomic
 * replacement, capture review state, session confirmation, and background upload queuing.
 */
class GuidedCaptureManager(
    val alignmentToleranceDeg: Float = GuidedHeadingCalculator.DEFAULT_ALIGNMENT_TOLERANCE_DEG,
    val uploadService: CaptureUploadService = DefaultCaptureUploadService()
) {
    val sessionId: String = UUID.randomUUID().toString()
    val points: List<CapturePoint> = GuidedHeadingCalculator.generateStandard8Points()
    val uploadQueue: BackgroundUploadQueue = BackgroundUploadQueue(uploadService)

    var currentIndex by mutableStateOf(0)
        private set

    var currentEvaluation by mutableStateOf(
        GuidedHeadingEvaluation(
            deltaDegrees = 0.0f,
            state = CapturePointState.NOT_ALIGNED,
            directionText = "Initializing",
            isGuidanceAvailable = false
        )
    )
        private set

    var isSessionCompleted by mutableStateOf(false)
        private set

    var isReviewing by mutableStateOf(false)

    var selectedPreviewPoint by mutableStateOf<CapturePoint?>(null)

    var sessionStatus by mutableStateOf(SessionStatus.IN_PROGRESS)
        private set

    var isCapturing by mutableStateOf(false)
        private set

    var activeRetakeIndex by mutableStateOf<Int?>(null)
        private set

    private var lastRawHeading: Float? = null

    val currentPoint: CapturePoint
        get() = points[currentIndex]

    val capturedCount: Int
        get() = points.count { it.capturedPhoto != null }

    val totalPoints: Int
        get() = points.size

    val allPointsCaptured: Boolean
        get() = points.size == 8 && points.all { it.capturedPhoto != null }

    val uploadedCount: Int
        get() = points.count { it.uploadState == UploadState.UPLOADED }

    val isUploadingAny: Boolean
        get() = points.any { it.uploadState == UploadState.UPLOADING }

    val hasFailedUploads: Boolean
        get() = points.any { it.uploadState == UploadState.FAILED }

    val allUploaded: Boolean
        get() = points.size == 8 && points.all { it.uploadState == UploadState.UPLOADED }

    /**
     * Updates real-time orientation heading from hardware sensors.
     */
    fun onHeadingUpdated(currentHeading: Float?) {
        lastRawHeading = currentHeading
        if (isSessionCompleted && !isReviewing && activeRetakeIndex == null) return

        currentEvaluation = GuidedHeadingCalculator.evaluate(
            currentHeading = currentHeading,
            targetHeading = currentPoint.targetHeadingDegrees,
            toleranceDeg = alignmentToleranceDeg
        )

        // Sync active point alignment state
        if (currentPoint.state != CapturePointState.CAPTURED || activeRetakeIndex != null) {
            currentPoint.state = currentEvaluation.state
        }
    }

    /**
     * Attempts photo capture on the current guided point.
     * Enforces strict alignment check: rejects capture if misaligned.
     * Implements safe replacement: if retaking, keeps the old photo until replacement succeeds.
     * Queues background upload immediately upon successful capture without blocking camera.
     */
    fun attemptCapture(
        cameraManager: CameraXManager,
        onPhotoSaved: (CapturedPhoto) -> Unit,
        onMisaligned: (String) -> Unit,
        onFailure: (String) -> Unit
    ) {
        if (isCapturing) return

        // 1. Enforce sensor availability & alignment check
        if (!currentEvaluation.isGuidanceAvailable) {
            onMisaligned("Orientation guidance unavailable")
            return
        }

        if (currentEvaluation.state != CapturePointState.ALIGNED) {
            onMisaligned("Align camera first")
            return
        }

        isCapturing = true
        val pointToUpdate = currentPoint
        val previousPhoto = pointToUpdate.capturedPhoto

        // 2. Trigger real CameraX ImageCapture
        cameraManager.takePhoto(
            onSuccess = { newPhoto ->
                isCapturing = false

                // Validate the newly captured image
                val validation = CapturedImageValidator.validate(newPhoto.file)
                if (validation is ValidationResult.Invalid) {
                    newPhoto.file.delete()
                    // Keep previous valid image intact
                    onFailure("Captured image failed validation: ${validation.reason}")
                    return@takePhoto
                }

                // Safely delete previous file now that new capture is verified
                if (previousPhoto != null && previousPhoto.file.absolutePath != newPhoto.file.absolutePath) {
                    try {
                        if (previousPhoto.file.exists()) {
                            previousPhoto.file.delete()
                        }
                    } catch (_: Exception) {}
                }

                // Update point with the verified new photo and metadata
                pointToUpdate.capturedPhoto = newPhoto
                pointToUpdate.actualHeadingDegrees = lastRawHeading ?: pointToUpdate.targetHeadingDegrees
                pointToUpdate.captureTimestamp = newPhoto.captureTimestamp
                pointToUpdate.state = CapturePointState.CAPTURED
                onPhotoSaved(newPhoto)

                // Queue upload in background without blocking camera UI
                uploadQueue.enqueuePoint(pointToUpdate, sessionId) {
                    checkUploadStatusTransition()
                }

                activeRetakeIndex = null

                // If all 8 points are captured, transition to Review mode
                if (allPointsCaptured) {
                    isSessionCompleted = true
                    isReviewing = true
                    if (sessionStatus != SessionStatus.READY_FOR_PROCESSING) {
                        sessionStatus = if (allUploaded) SessionStatus.READY_FOR_PROCESSING else SessionStatus.REVIEWING
                    }
                } else if (currentIndex < points.size - 1) {
                    currentIndex++
                }
            },
            onError = { exc ->
                isCapturing = false
                // Previous valid image is safely preserved on pointToUpdate
                onFailure("Capture failed: ${exc.message}")
            }
        )
    }

    /**
     * Switches into retake mode for a specific capture point (1..8).
     * Navigates back to the live CameraX preview targeting that point's heading.
     */
    fun selectPointForRetake(pointIndex: Int) {
        val targetIndex = (pointIndex - 1).coerceIn(0, points.size - 1)
        currentIndex = targetIndex
        activeRetakeIndex = targetIndex
        isReviewing = false
        selectedPreviewPoint = null
    }

    /**
     * Retakes the previous or current capture point in sequence.
     */
    fun retakeCurrentOrPreviousPoint() {
        val targetIndex = if (currentPoint.capturedPhoto != null) {
            currentIndex
        } else if (currentIndex > 0) {
            currentIndex - 1
        } else {
            currentIndex
        }

        selectPointForRetake(targetIndex + 1)
    }

    /**
     * Retries upload for a specific point.
     */
    fun retryUpload(pointIndex: Int) {
        val targetPoint = points.getOrNull(pointIndex - 1) ?: return
        uploadQueue.retryPoint(targetPoint, sessionId) {
            checkUploadStatusTransition()
        }
    }

    /**
     * Retries all failed uploads.
     */
    fun retryAllFailedUploads() {
        uploadQueue.retryAllFailed(points, sessionId) {
            checkUploadStatusTransition()
        }
    }

    private fun checkUploadStatusTransition() {
        if (allUploaded) {
            sessionStatus = SessionStatus.READY_FOR_PROCESSING
        } else if (isUploadingAny && sessionStatus != SessionStatus.READY_FOR_PROCESSING) {
            sessionStatus = SessionStatus.UPLOADING
        }
    }

    /**
     * Validates and confirms the complete 8-point capture set.
     * Transitions session to READY_FOR_STITCHING if valid and local-only.
     * If all images are also uploaded, transitions to READY_FOR_PROCESSING.
     */
    fun confirmCaptureSet(): CaptureSetValidationResult {
        val validation = CaptureSetValidator.validatePoints(points)
        if (validation is CaptureSetValidationResult.Valid) {
            sessionStatus = if (allUploaded) {
                SessionStatus.READY_FOR_PROCESSING
            } else {
                SessionStatus.READY_FOR_STITCHING
            }
        }
        return validation
    }

    /**
     * Discards the entire capture session:
     * Safely deletes all temporary captured JPEG files, cancels active uploads, and resets session state.
     */
    fun discardSession() {
        uploadQueue.cancelAll()

        for (point in points) {
            point.capturedPhoto?.file?.let { file ->
                try {
                    if (file.exists()) file.delete()
                } catch (_: Exception) {}
            }
            point.capturedPhoto = null
            point.state = CapturePointState.NOT_ALIGNED
            point.actualHeadingDegrees = null
            point.captureTimestamp = null
            point.uploadState = UploadState.PENDING
            point.uploadAttemptCount = 0
            point.lastUploadError = null
            point.remoteAssetId = null
            point.uploadedTimestamp = null
        }

        currentIndex = 0
        isSessionCompleted = false
        isReviewing = false
        selectedPreviewPoint = null
        activeRetakeIndex = null
        sessionStatus = SessionStatus.DISCARDED
    }

    /**
     * Returns the structured RoomCaptureSession.
     */
    fun getSessionSummary(): RoomCaptureSession {
        return RoomCaptureSession(
            sessionId = sessionId,
            totalPoints = totalPoints,
            points = points.toList(),
            isCompleted = isSessionCompleted,
            status = sessionStatus,
            completionSummary = "$capturedCount captured images ($uploadedCount uploaded)"
        )
    }
}
