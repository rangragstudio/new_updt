package com.renderwalk.camera.insta360

/**
 * Camera Provider and Model Detection Boundary for Official Insta360 Hardware.
 *
 * Exposes connected camera model across supported panoramic portfolio:
 * - Insta360 X6
 * - Insta360 X5
 * - Insta360 X4 Air
 * - Insta360 X4
 * - Insta360 X3
 * - Insta360 ONE RS
 * - Insta360 ONE RS 1-Inch 360
 * - Other SDK-supported panoramic models
 */
class Insta360CameraProvider(
    private val sdkAdapter: Insta360SdkAdapter
) {
    companion object {
        val SUPPORTED_PANORAMIC_MODELS = listOf(
            "X6",
            "X5",
            "X4 Air",
            "X4",
            "X3",
            "ONE RS",
            "ONE RS 1-Inch"
        )
    }

    private var connectedModel: String? = null
    private var isConnected: Boolean = false

    public fun isConnected(): Boolean = isConnected

    public fun getConnectedModel(): String? = connectedModel

    public fun connect(deviceId: String, model: String): Boolean {
        if (!sdkAdapter.isSdkAvailable()) {
            throw IllegalStateException(Insta360SdkAdapter.STATUS_SDK_NOT_AVAILABLE)
        }
        connectedModel = model
        isConnected = true
        return true
    }

    public fun disconnect() {
        connectedModel = null
        isConnected = false
    }

    public fun getCapabilities(photoMode: String = "PHOTO", resolution: PhotoResolution? = null): DynamicCameraCapabilities {
        return Insta360CapabilityMapper.mapCapabilities(
            cameraModel = connectedModel,
            photoMode = photoMode,
            resolution = resolution,
            isSdkConfigured = sdkAdapter.isSdkAvailable() && isConnected
        )
    }
}
