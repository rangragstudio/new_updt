package com.renderwalk.camera.phone

import android.net.Uri
import java.io.File

/**
 * Camera lens facing for the phone hardware.
 */
enum class CameraLensFacing {
    BACK,
    FRONT
}

/**
 * Model representing a verified, captured photo stored in local app storage.
 */
data class CapturedPhoto(
    val file: File,
    val uri: Uri,
    val width: Int,
    val height: Int,
    val fileSizeBytes: Long,
    val captureTimestamp: Long,
    val facing: CameraLensFacing,
    val mimeType: String = "image/jpeg"
)

/**
 * Sealed result for post-capture image verification.
 */
sealed class ValidationResult {
    object Valid : ValidationResult()
    data class Invalid(val reason: String) : ValidationResult()
}
