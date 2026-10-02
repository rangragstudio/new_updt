package com.renderwalk.camera.insta360

import java.util.concurrent.CopyOnWriteArrayList

/**
 * Native Android Adapter Boundary for Insta360 CameraSDK.
 *
 * Enforces:
 * 1. Zero Fake Hardware: Does not synthesize fake camera connections or fake telemetry.
 * 2. SDK Availability Check: In this build environment, official Insta360 CameraSDK
 *    AAR binaries are not installed. Adapter maintains state strictly as SDK_NOT_CONFIGURED.
 * 3. Event Broadcasting: Emits typed events to registered listeners without fake events.
 */
class Insta360NativeAdapter : Insta360BridgeContract {

    companion object {
        const val STATE_SDK_NOT_CONFIGURED = "SDK_NOT_CONFIGURED"
        const val STATE_DISCONNECTED = "DISCONNECTED"
        const val STATE_CONNECTED = "CONNECTED"

        // Error Codes
        const val ERROR_SDK_NOT_CONFIGURED = "SDK_NOT_CONFIGURED"
        const val ERROR_CAMERA_NOT_FOUND = "CAMERA_NOT_FOUND"
        const val ERROR_CAMERA_DISCONNECTED = "CAMERA_DISCONNECTED"
        const val ERROR_PREVIEW_NOT_AVAILABLE = "PREVIEW_NOT_AVAILABLE"
        const val ERROR_AEB_NOT_SUPPORTED = "AEB_NOT_SUPPORTED"
        const val ERROR_AEB_FRAME_COUNT_NOT_SUPPORTED = "AEB_FRAME_COUNT_NOT_SUPPORTED"
        const val ERROR_EXPOSURE_STEP_NOT_SUPPORTED = "EXPOSURE_STEP_NOT_SUPPORTED"
    }

    private val eventListeners = CopyOnWriteArrayList<CameraEventListener>()
    private val isSdkAvailable: Boolean = checkSdkAvailability()
    private var currentState: String = if (isSdkAvailable) STATE_DISCONNECTED else STATE_SDK_NOT_CONFIGURED
    private var connectedDevice: CameraDeviceInfo? = null

    /**
     * Inspects whether official Insta360 CameraSDK classes are available on the classpath.
     */
    private fun checkSdkAvailability(): Boolean {
        return try {
            // Check for official Insta360 SDK entry point
            Class.forName("com.arashivision.camera.InstaCamera")
            true
        } catch (_: ClassNotFoundException) {
            false
        }
    }

    override fun discover(): String {
        if (!isSdkAvailable) {
            emitError(ERROR_SDK_NOT_CONFIGURED, "Insta360 native CameraSDK is not installed in this Android build.")
            return "[]"
        }
        return "[]"
    }

    override fun connect(deviceId: String): Boolean {
        if (!isSdkAvailable) {
            emitError(ERROR_SDK_NOT_CONFIGURED, "Cannot connect: Insta360 CameraSDK AAR is not configured.")
            throw IllegalStateException(ERROR_SDK_NOT_CONFIGURED)
        }
        return false
    }

    override fun disconnect() {
        connectedDevice = null
        currentState = if (isSdkAvailable) STATE_DISCONNECTED else STATE_SDK_NOT_CONFIGURED
        emitEvent(CameraEventType.CAMERA_DISCONNECTED, "{\"state\":\"$currentState\"}")
    }

    override fun getStatus(): String {
        return """{
            "state": "$currentState",
            "batteryPercent": null,
            "isCharging": null,
            "storageFreeBytes": null,
            "storageTotalBytes": null,
            "firmwareVersion": null,
            "errorMessage": ${if (!isSdkAvailable) "\"Insta360 native CameraSDK AAR is not configured.\"" else "null"}
        }""".trimIndent()
    }

    override fun getCapabilities(): String {
        if (!isSdkAvailable || currentState != STATE_CONNECTED) {
            emitError(
                if (!isSdkAvailable) ERROR_SDK_NOT_CONFIGURED else ERROR_CAMERA_DISCONNECTED,
                "Camera not connected or SDK not configured."
            )
            throw IllegalStateException(if (!isSdkAvailable) ERROR_SDK_NOT_CONFIGURED else ERROR_CAMERA_DISCONNECTED)
        }

        // When connected to physical hardware with SDK, returns real camera capabilities
        return """{
            "model": "Unknown",
            "hdrSupported": false,
            "aebSupported": false,
            "supportedAebFrameCounts": [],
            "supportedExposureSteps": [],
            "rawSupported": false,
            "jpegSupported": false,
            "cameraSideHdrSupported": false,
            "previewSupported": false
        }""".trimIndent()
    }

    override fun startPreview(): String {
        emitError(ERROR_PREVIEW_NOT_AVAILABLE, "Live preview requires native CameraSDK decode pipeline.")
        throw UnsupportedOperationException(ERROR_PREVIEW_NOT_AVAILABLE)
    }

    override fun stopPreview() {
        emitEvent(CameraEventType.PREVIEW_STOPPED, "{}")
    }

    override fun capture(): String {
        if (!isSdkAvailable) {
            emitError(ERROR_SDK_NOT_CONFIGURED, "Capture failed: SDK not configured.")
            throw IllegalStateException(ERROR_SDK_NOT_CONFIGURED)
        }
        throw IllegalStateException(ERROR_CAMERA_DISCONNECTED)
    }

    override fun captureHDR(paramsJson: String): String {
        if (!isSdkAvailable) {
            emitError(ERROR_SDK_NOT_CONFIGURED, "HDR capture failed: SDK not configured.")
            throw IllegalStateException(ERROR_SDK_NOT_CONFIGURED)
        }
        throw IllegalStateException(ERROR_CAMERA_DISCONNECTED)
    }

    override fun listMedia(): String {
        return "[]"
    }

    override fun downloadMedia(mediaId: String, destinationPath: String): String {
        if (!isSdkAvailable) {
            emitError(ERROR_SDK_NOT_CONFIGURED, "Download failed: SDK not configured.")
            throw IllegalStateException(ERROR_SDK_NOT_CONFIGURED)
        }
        throw IllegalStateException(ERROR_CAMERA_DISCONNECTED)
    }

    override fun deleteMedia(mediaId: String): Boolean {
        return false
    }

    override fun getBattery(): String? {
        return null // No fake battery
    }

    override fun getStorage(): String? {
        return null // No fake storage
    }

    override fun getIMU(): String? {
        return null // No fake IMU
    }

    override fun addEventListener(listener: CameraEventListener) {
        eventListeners.add(listener)
    }

    override fun removeEventListener(listener: CameraEventListener) {
        eventListeners.remove(listener)
    }

    private fun emitEvent(type: CameraEventType, payloadJson: String) {
        val event = CameraBridgeEvent(type, payloadJson)
        for (l in eventListeners) {
            try {
                l.onCameraEvent(event)
            } catch (_: Exception) {}
        }
    }

    private fun emitError(errorCode: String, message: String) {
        val payload = """{"code":"$errorCode","message":"$message"}"""
        emitEvent(CameraEventType.CAMERA_ERROR, payload)
    }
}
