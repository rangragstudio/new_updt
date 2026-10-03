package com.renderwalk.camera.phone

import java.io.File
import java.util.UUID
import kotlin.math.abs

/**
 * Alignment and capture lifecycle state for a specific capture point.
 */
enum class CapturePointState {
    NOT_ALIGNED,
    ALIGNED,
    CAPTURED
}

/**
 * Upload state for an individual capture point's image asset.
 */
enum class UploadState {
    PENDING,
    UPLOADING,
    UPLOADED,
    FAILED
}

/**
 * Device network connectivity state for background sync.
 */
enum class NetworkStatus {
    ONLINE,
    OFFLINE,
    NETWORK_ERROR
}

/**
 * High-level lifecycle state for a multi-point room capture session.
 */
enum class SessionStatus {
    IN_PROGRESS,
    REVIEWING,
    UPLOADING,
    UPLOAD_COMPLETE,
    READY_FOR_STITCHING,
    READY_FOR_PROCESSING,
    DISCARDED
}

/**
 * Capture point representation in the 360-degree room guidance sequence.
 */
data class CapturePoint(
    val index: Int,                         // 1 to 8
    val targetHeadingDegrees: Float,        // 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
    var state: CapturePointState = CapturePointState.NOT_ALIGNED,
    var capturedPhoto: CapturedPhoto? = null, // Real local image reference upon genuine capture
    var actualHeadingDegrees: Float? = null,  // Physical heading at moment of capture
    var captureTimestamp: Long? = null,       // Timestamp in ms when capture occurred
    var uploadState: UploadState = UploadState.PENDING,
    var uploadAttemptCount: Int = 0,
    var lastUploadError: String? = null,
    var remoteAssetId: String? = null,        // Remote asset ID returned by server on real receipt (no fake IDs)
    var uploadedTimestamp: Long? = null
)

/**
 * Metadata payload required by the server to incrementally receive an asset
 * and later reconstruct capture sequence without premature stitching.
 */
data class UploadAssetPayload(
    val sessionId: String,
    val capturePointId: Int,
    val localFilePath: String,
    val targetHeadingDegrees: Float,
    val actualHeadingDegrees: Float,
    val captureTimestamp: Long,
    val width: Int,
    val height: Int,
    val fileSizeBytes: Long
)

/**
 * Evaluated alignment result for the active capture point.
 */
data class GuidedHeadingEvaluation(
    val deltaDegrees: Float,                // Signed angular difference (-180 to +180)
    val state: CapturePointState,           // ALIGNED or NOT_ALIGNED
    val directionText: String,              // "TURN LEFT", "TURN RIGHT", "ALIGNED", or "Orientation guidance unavailable"
    val isGuidanceAvailable: Boolean = true
)

/**
 * Result of validating an 8-point capture set before confirming session.
 */
sealed class CaptureSetValidationResult {
    object Valid : CaptureSetValidationResult()
    data class Invalid(val errors: List<String>) : CaptureSetValidationResult()
}

/**
 * Local capture session storing the 8 capture points and local image references.
 * Kept entirely on-device; does not produce a stitched panorama or cloud scan.
 */
data class RoomCaptureSession(
    val sessionId: String = UUID.randomUUID().toString(),
    val totalPoints: Int = 8,
    val points: List<CapturePoint>,
    val isCompleted: Boolean = false,
    var status: SessionStatus = SessionStatus.IN_PROGRESS,
    val completionSummary: String = "${points.count { it.capturedPhoto != null }} captured images ready for stitching"
)

/**
 * Strict validator for a complete 8-point capture set.
 */
object CaptureSetValidator {

    fun validate(session: RoomCaptureSession): CaptureSetValidationResult {
        return validatePoints(session.points)
    }

    fun validatePoints(points: List<CapturePoint>): CaptureSetValidationResult {
        val errors = mutableListOf<String>()

        // 1. Total point count verification
        if (points.size != 8) {
            errors.add("Capture set is incomplete: contains ${points.size} of 8 required points.")
        }

        // 2. Duplicate or missing point index verification
        val indices = points.map { it.index }
        if (indices.distinct().size != points.size) {
            errors.add("Duplicate point assignments detected in capture sequence.")
        }
        for (expectedIndex in 1..8) {
            if (!indices.contains(expectedIndex)) {
                errors.add("Point $expectedIndex is missing from capture sequence.")
            }
        }

        // 3. Inspect each capture point individually
        for (point in points) {
            val photo = point.capturedPhoto
            if (photo == null) {
                errors.add("Point ${point.index} image is missing.")
                continue
            }

            // File existence
            if (!photo.file.exists()) {
                errors.add("Point ${point.index} photo file does not exist on disk: ${photo.file.name}.")
                continue
            }

            // Non-empty file size
            if (photo.file.length() <= 0L) {
                errors.add("Point ${point.index} photo file is empty (0 bytes).")
                continue
            }

            // Decodable image check
            val validation = CapturedImageValidator.validate(photo.file)
            if (validation is ValidationResult.Invalid) {
                errors.add("Point ${point.index} image cannot be read: ${validation.reason}")
                continue
            }

            // Metadata check
            if (photo.width <= 0 || photo.height <= 0) {
                errors.add("Point ${point.index} has invalid image dimensions (${photo.width}x${photo.height}).")
            }
            if (point.actualHeadingDegrees == null) {
                errors.add("Point ${point.index} is missing physical capture heading metadata.")
            }
            if (point.captureTimestamp == null) {
                errors.add("Point ${point.index} is missing capture timestamp metadata.")
            }
        }

        return if (errors.isEmpty()) {
            CaptureSetValidationResult.Valid
        } else {
            CaptureSetValidationResult.Invalid(errors)
        }
    }
}

/**
 * Heading calculation and alignment engine with angle wraparound handling.
 */
object GuidedHeadingCalculator {

    // Configurable angular tolerance (default +/- 8 degrees)
    const val DEFAULT_ALIGNMENT_TOLERANCE_DEG = 8.0f

    /**
     * Calculates the shortest signed angular difference from current heading to target heading.
     * Uses modulo arithmetic for proper angle wraparound across the 0° / 360° discontinuity.
     * Example:
     *   current = 359°, target = 1°  -> returns +2.0° (turn right 2°)
     *   current = 1°,   target = 359° -> returns -2.0° (turn left 2°)
     */
    fun calculateHeadingDelta(currentHeading: Float, targetHeading: Float): Float {
        return (targetHeading - currentHeading + 540.0f) % 360.0f - 180.0f
    }

    /**
     * Evaluates alignment against a target heading given current real sensor heading.
     */
    fun evaluate(
        currentHeading: Float?,
        targetHeading: Float,
        toleranceDeg: Float = DEFAULT_ALIGNMENT_TOLERANCE_DEG
    ): GuidedHeadingEvaluation {
        if (currentHeading == null) {
            return GuidedHeadingEvaluation(
                deltaDegrees = 0.0f,
                state = CapturePointState.NOT_ALIGNED,
                directionText = "Orientation guidance unavailable",
                isGuidanceAvailable = false
            )
        }

        val delta = calculateHeadingDelta(currentHeading, targetHeading)
        val isAligned = abs(delta) <= toleranceDeg

        val state = if (isAligned) CapturePointState.ALIGNED else CapturePointState.NOT_ALIGNED
        val directionText = when {
            isAligned -> "ALIGNED"
            delta > 0.0f -> "TURN RIGHT"
            else -> "TURN LEFT"
        }

        return GuidedHeadingEvaluation(
            deltaDegrees = delta,
            state = state,
            directionText = directionText,
            isGuidanceAvailable = true
        )
    }

    /**
     * Generates standard 8-point horizontal rotation positions around 360 degrees.
     * Point 1: 0°, Point 2: 45°, Point 3: 90°, Point 4: 135°,
     * Point 5: 180°, Point 6: 225°, Point 7: 270°, Point 8: 315°.
     */
    fun generateStandard8Points(): List<CapturePoint> {
        val step = 360.0f / 8.0f
        return (1..8).map { index ->
            CapturePoint(
                index = index,
                targetHeadingDegrees = (index - 1) * step,
                state = CapturePointState.NOT_ALIGNED,
                capturedPhoto = null,
                actualHeadingDegrees = null,
                captureTimestamp = null,
                uploadState = UploadState.PENDING,
                uploadAttemptCount = 0,
                lastUploadError = null,
                remoteAssetId = null,
                uploadedTimestamp = null
            )
        }
    }
}
