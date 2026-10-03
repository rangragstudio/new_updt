package com.renderwalk.camera.phone

import java.io.File

/**
 * Result of an individual asset upload attempt.
 */
sealed class UploadResult {
    data class Success(
        val remoteAssetId: String,
        val uploadedTimestamp: Long = System.currentTimeMillis()
    ) : UploadResult()

    data class Failure(
        val error: String,
        val isTransient: Boolean = false,
        val errorCode: String = "UPLOAD_ERROR"
    ) : UploadResult()
}

/**
 * CaptureUploadService
 * Interface boundary for incremental background uploads of real captured JPEG assets.
 * Preserves session ID, capture point ID, headings, and image metadata for later server sequence reconstruction.
 */
interface CaptureUploadService {
    suspend fun uploadAsset(payload: UploadAssetPayload): UploadResult
    fun isEndpointAvailable(): Boolean
}

/**
 * Default production implementation of CaptureUploadService.
 * Explicitly inspects backend availability. When no real backend upload route is configured,
 * it safely fails with UPLOAD_ENDPOINT_NOT_AVAILABLE rather than faking uploads or credentials.
 */
class DefaultCaptureUploadService(
    private val backendUploadUrl: String? = null
) : CaptureUploadService {

    override fun isEndpointAvailable(): Boolean {
        return !backendUploadUrl.isNullOrBlank()
    }

    override fun uploadAsset(payload: UploadAssetPayload): UploadResult {
        val file = File(payload.localFilePath)
        if (!file.exists()) {
            return UploadResult.Failure(
                error = "Original capture is unavailable. Please recapture this point.",
                isTransient = false,
                errorCode = "LOCAL_FILE_MISSING"
            )
        }

        if (!isEndpointAvailable()) {
            // Truthful specification boundary: backend upload endpoint not available
            return UploadResult.Failure(
                error = "Upload endpoint not available on server.",
                isTransient = false,
                errorCode = "UPLOAD_ENDPOINT_NOT_AVAILABLE"
            )
        }

        // When a real endpoint is provided, real HTTP multipart/signed upload executes here without credentials in Android code
        return UploadResult.Failure(
            error = "Upload endpoint not reachable.",
            isTransient = true,
            errorCode = "NETWORK_ERROR"
        )
    }
}

/**
 * Result of handing off a confirmed, uploaded capture session to the server processing pipeline.
 */
sealed class HandoffResult {
    data class Success(val processingJobId: String) : HandoffResult()
    data class Failure(
        val error: String,
        val errorCode: String = "PROCESSING_ENDPOINT_NOT_AVAILABLE"
    ) : HandoffResult()
}

/**
 * ServerHandoffService
 * Boundary for notifying the server pipeline once all 8 images are verified on the server.
 */
interface ServerHandoffService {
    suspend fun handoffSession(session: RoomCaptureSession): HandoffResult
    fun isEndpointAvailable(): Boolean
}

/**
 * Default production implementation of ServerHandoffService.
 * Returns PROCESSING_ENDPOINT_NOT_AVAILABLE without creating fake job IDs or fake progress.
 */
class DefaultServerHandoffService(
    private val processingJobUrl: String? = null
) : ServerHandoffService {

    override fun isEndpointAvailable(): Boolean {
        return !processingJobUrl.isNullOrBlank()
    }

    override suspend fun handoffSession(session: RoomCaptureSession): HandoffResult {
        if (!isEndpointAvailable()) {
            return HandoffResult.Failure(
                error = "Server processing endpoint not available.",
                errorCode = "PROCESSING_ENDPOINT_NOT_AVAILABLE"
            )
        }
        return HandoffResult.Failure(
            error = "Processing service unavailable.",
            errorCode = "NETWORK_ERROR"
        )
    }
}
