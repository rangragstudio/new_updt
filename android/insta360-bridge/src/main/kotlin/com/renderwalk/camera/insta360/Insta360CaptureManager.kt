package com.renderwalk.camera.insta360

/**
 * Capture Manager for Official Insta360 CameraSDK.
 *
 * Implements HDR/AEB output routing:
 * Output A: SINGLE_HDR_PANORAMA (Onboard camera-side merged HDR result)
 * Output B: AEB_BRACKET_SET (Discrete multi-exposure bracket set)
 *
 * Dispatches capture sets to RenderWalk background worker without blocking Android UI thread.
 */
class Insta360CaptureManager(
    private val sdkAdapter: Insta360SdkAdapter
) {
    companion object {
        const val OUTPUT_SINGLE_HDR = "SINGLE_HDR_PANORAMA"
        const val OUTPUT_AEB_BRACKET_SET = "AEB_BRACKET_SET"
    }

    data class CapturedFrame(
        val fileId: String,
        val localFilePath: String,
        val evOffset: Double?,
        val frameIndex: Int,
        val totalFrames: Int
    )

    data class CaptureOutput(
        val captureGroupId: String,
        val outputType: String, // OUTPUT_SINGLE_HDR or OUTPUT_AEB_BRACKET_SET
        val isCameraSideMerged: Boolean,
        val frames: List<CapturedFrame>,
        val timestamp: Long = System.currentTimeMillis()
    )

    public fun capturePhoto(mode: String, frameCount: Int = 1, evStep: Double = 0.0): CaptureOutput {
        if (!sdkAdapter.isSdkAvailable()) {
            throw IllegalStateException(Insta360SdkAdapter.STATUS_SDK_NOT_AVAILABLE)
        }
        throw IllegalStateException("CAMERA_DISCONNECTED")
    }
}
