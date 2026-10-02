package com.renderwalk.camera.insta360

/**
 * Camera Event Types emitted across the Native Android Bridge to the web layer.
 */
enum class CameraEventType {
    CAMERA_DISCOVERED,
    CAMERA_CONNECTED,
    CAMERA_DISCONNECTED,
    CAMERA_STATUS_CHANGED,
    PREVIEW_STARTED,
    PREVIEW_STOPPED,
    CAPTURE_STARTED,
    CAPTURE_PROGRESS,
    CAPTURE_COMPLETED,
    MEDIA_AVAILABLE,
    DOWNLOAD_PROGRESS,
    DOWNLOAD_COMPLETED,
    CAMERA_ERROR
}

data class CameraBridgeEvent(
    val eventType: CameraEventType,
    val payloadJson: String,
    val timestamp: Long = System.currentTimeMillis()
)

fun interface CameraEventListener {
    fun onCameraEvent(event: CameraBridgeEvent)
}
