package com.renderwalk.camera.insta360

/**
 * Official Insta360 Android SDK Integration Boundary.
 *
 * Enforces:
 * 1. OFFICIAL SDK ONLY: Connects only to official Insta360 CameraSDK and MediaSDK.
 * 2. ZERO FAKE SDK: If official AAR binaries are not linked, state is strictly INSTA360_SDK_NOT_AVAILABLE.
 * 3. CONNECTION METHODS: Prepares transport handlers for USB OTG, Wi-Fi (SoftAP), and Bluetooth BLE.
 */
class Insta360SdkAdapter {

    companion object {
        const val STATUS_SDK_NOT_AVAILABLE = "INSTA360_SDK_NOT_AVAILABLE"
        const val STATUS_SDK_CONFIGURED = "INSTA360_SDK_CONFIGURED"

        // Transport types supported by official Insta360 hardware
        const val TRANSPORT_USB = "USB"
        const val TRANSPORT_WIFI = "WIFI"
        const val TRANSPORT_BLE = "BLE"
    }

    private val isCameraSdkPresent: Boolean = checkCameraSdkPresent()
    private val isMediaSdkPresent: Boolean = checkMediaSdkPresent()

    /**
     * Inspects classpath via reflection for official Insta360 Camera SDK classes
     * without fabricating fake imports.
     */
    private fun checkCameraSdkPresent(): Boolean {
        return try {
            Class.forName("com.arashivision.camera.InstaCamera")
            true
        } catch (_: ClassNotFoundException) {
            false
        }
    }

    /**
     * Inspects classpath via reflection for official Insta360 Media SDK classes.
     */
    private fun checkMediaSdkPresent(): Boolean {
        return try {
            Class.forName("com.arashivision.media.export.ExportManager")
            true
        } catch (_: ClassNotFoundException) {
            false
        }
    }

    public fun isSdkAvailable(): Boolean = isCameraSdkPresent && isMediaSdkPresent

    public fun getSdkStatus(): String {
        return if (isSdkAvailable()) STATUS_SDK_CONFIGURED else STATUS_SDK_NOT_AVAILABLE
    }

    public fun getSupportedTransports(): List<String> {
        return if (isSdkAvailable()) {
            listOf(TRANSPORT_USB, TRANSPORT_WIFI, TRANSPORT_BLE)
        } else {
            emptyList()
        }
    }
}
