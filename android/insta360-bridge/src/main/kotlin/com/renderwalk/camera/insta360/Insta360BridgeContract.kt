package com.renderwalk.camera.insta360

/**
 * Android Native Camera Bridge Interface for Insta360.
 *
 * Defines the public contract exposed to the web application runtime.
 * Guarantees zero fake hardware, strict validation, and non-blocking background processing.
 */
interface Insta360BridgeContract {
    /** Probe local network / BLE / USB for Insta360 devices */
    fun discover(): String // Returns JSON array of discovered devices

    /** Connect to target camera device ID */
    fun connect(deviceId: String): Boolean

    /** Disconnect current camera session */
    fun disconnect()

    /** Snapshot of camera connection, battery, and storage status */
    fun getStatus(): String // Returns JSON CameraStatusInfo

    /** Query dynamic hardware capabilities reported by the connected camera */
    fun getCapabilities(): String // Returns JSON CameraCapabilitiesInfo

    /** Request live preview stream surface/texture */
    fun startPreview(): String // Returns JSON stream endpoint or throws PREVIEW_NOT_AVAILABLE

    /** Stop live preview */
    fun stopPreview()

    /** Trigger standard single photo capture */
    fun capture(): String // Returns JSON NativeCaptureResult

    /** Trigger HDR or bracketed AEB capture sequence */
    fun captureHDR(paramsJson: String): String // Returns JSON NativeCaptureResult

    /** List media files stored on camera SD card */
    fun listMedia(): String // Returns JSON array of CameraMediaItem

    /** Download camera media file to local cache path without deleting original */
    fun downloadMedia(mediaId: string, destinationPath: String): String // Returns JSON with localFilePath and bytesDownloaded

    /** Delete media item from camera SD card */
    fun deleteMedia(mediaId: String): Boolean

    /** Read real battery level from hardware */
    fun getBattery(): String? // Returns JSON BatteryInfo or null if unavailable

    /** Read real storage capacity from onboard SD card */
    fun getStorage(): String? // Returns JSON StorageInfo or null if unavailable

    /** Read real IMU angles from onboard gyro/accelerometer */
    fun getIMU(): String? // Returns JSON IMUInfo or null if unsupported

    /** Register event listener for asynchronous camera notifications */
    fun addEventListener(listener: CameraEventListener)

    /** Remove event listener */
    fun removeEventListener(listener: CameraEventListener)
}

data class CameraDeviceInfo(
    val deviceId: String,
    val model: String,
    val serialNumber: String,
    val firmwareVersion: String,
    val connectionType: String
)

data class CameraStatusInfo(
    val state: String,
    val batteryPercent: Int?,
    val isCharging: Boolean?,
    val storageFreeBytes: Long?,
    val storageTotalBytes: Long?,
    val firmwareVersion: String?,
    val errorMessage: String?
)

data class CameraCapabilitiesInfo(
    val model: String,
    val hdrSupported: Boolean,
    val aebSupported: Boolean,
    val supportedAebFrameCounts: List<Int>,
    val supportedExposureSteps: List<Double>,
    val rawSupported: Boolean,
    val jpegSupported: Boolean,
    val cameraSideHdrSupported: Boolean,
    val previewSupported: Boolean
)

data class HDRCaptureParams(
    val mode: String, // "NORMAL" | "HDR" | "AEB"
    val frameCount: Int?, // 3, 5, 7, 9
    val exposureStep: Double?, // 0.5, 1.0, 1.5, 2.0
    val outputFormat: String, // "JPEG" | "RAW"
    val mergeMode: String // "CAMERA" | "RENDERWALK"
)

data class NativeCaptureResult(
    val captureGroupId: String,
    val timestamp: Long,
    val mode: String,
    val isCameraSideMerged: Boolean,
    val files: List<NativeFileInfo>
)

data class NativeFileInfo(
    val fileId: String,
    val filename: String,
    val localFilePath: String,
    val sizeBytes: Long,
    val evOffset: Double?,
    val frameIndex: Int?
)

data class CameraMediaItem(
    val id: String,
    val name: String,
    val sizeBytes: Long,
    val createdAt: Long,
    val mimeType: String
)

data class BatteryInfo(
    val levelPercent: Int,
    val isCharging: Boolean
)

data class StorageInfo(
    val freeBytes: Long,
    val totalBytes: Long
)

data class IMUInfo(
    val roll: Double,
    val pitch: Double,
    val yaw: Double?
)
