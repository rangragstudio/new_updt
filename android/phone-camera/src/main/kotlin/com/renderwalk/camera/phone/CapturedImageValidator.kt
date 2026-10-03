package com.renderwalk.camera.phone

import android.graphics.BitmapFactory
import java.io.File

/**
 * Image Validation Engine
 * Verifies that the captured image on disk is fully readable, non-empty, and valid.
 */
object CapturedImageValidator {

    /**
     * Validates that the captured image:
     * 1. File reference is non-null
     * 2. File exists on disk
     * 3. File size is greater than zero bytes
     * 4. Image can be decoded by BitmapFactory
     * 5. Width and Height are positive integers
     */
    fun validate(file: File?): ValidationResult {
        if (file == null) {
            return ValidationResult.Invalid("Image file reference is null.")
        }

        if (!file.exists()) {
            return ValidationResult.Invalid("Captured photo file does not exist on disk: ${file.absolutePath}")
        }

        if (file.length() <= 0L) {
            return ValidationResult.Invalid("Captured photo file is empty (0 bytes).")
        }

        return try {
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeFile(file.absolutePath, options)

            val width = options.outWidth
            val height = options.outHeight

            if (width <= 0 || height <= 0) {
                ValidationResult.Invalid("Invalid image dimensions decoded: ${width}x${height}.")
            } else if (options.outMimeType == null) {
                ValidationResult.Invalid("Failed to detect valid image MIME type from file header.")
            } else {
                ValidationResult.Valid
            }
        } catch (e: Exception) {
            ValidationResult.Invalid("Exception encountered while decoding image: ${e.message}")
        }
    }
}
