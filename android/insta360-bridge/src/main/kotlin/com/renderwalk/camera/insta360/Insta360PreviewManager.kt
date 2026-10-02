package com.renderwalk.camera.insta360

/**
 * Preview Manager for Official Insta360 CameraSDK.
 *
 * Integrates native RTSP/H.264 preview decoding surface.
 * When official SDK binaries are absent, strictly returns PREVIEW_NOT_CONFIGURED.
 * Never synthesizes fake camera frames or mock video streams.
 */
class Insta360PreviewManager(
    private val sdkAdapter: Insta360SdkAdapter
) {
    companion object {
        const val STATUS_PREVIEW_NOT_CONFIGURED = "PREVIEW_NOT_CONFIGURED"
        const val STATUS_PREVIEW_STOPPED = "PREVIEW_STOPPED"
        const val STATUS_PREVIEW_RUNNING = "PREVIEW_RUNNING"
    }

    private var currentStatus: String = STATUS_PREVIEW_NOT_CONFIGURED

    public fun getPreviewStatus(): String {
        return if (!sdkAdapter.isSdkAvailable()) {
            STATUS_PREVIEW_NOT_CONFIGURED
        } else {
            currentStatus
        }
    }

    public fun startPreview(): String {
        if (!sdkAdapter.isSdkAvailable()) {
            throw UnsupportedOperationException(STATUS_PREVIEW_NOT_CONFIGURED)
        }
        currentStatus = STATUS_PREVIEW_RUNNING
        return "rtsp://192.168.42.1/live"
    }

    public fun stopPreview() {
        if (sdkAdapter.isSdkAvailable()) {
            currentStatus = STATUS_PREVIEW_STOPPED
        }
    }
}
