package com.renderwalk.camera.phone

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Runtime states for the android.permission.CAMERA permission.
 */
enum class CameraPermissionState {
    NOT_REQUESTED,
    GRANTED,
    DENIED,
    PERMANENTLY_DENIED
}

object CameraPermissionHelper {
    const val CAMERA_PERMISSION = Manifest.permission.CAMERA

    /**
     * Checks if CAMERA permission is currently granted.
     */
    fun hasCameraPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            CAMERA_PERMISSION
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Evaluates permission state distinguishing standard denial from permanent denial (Don't ask again).
     */
    fun getPermissionState(activity: Activity): CameraPermissionState {
        return when {
            hasCameraPermission(activity) -> CameraPermissionState.GRANTED
            ActivityCompat.shouldShowRequestPermissionRationale(activity, CAMERA_PERMISSION) -> CameraPermissionState.DENIED
            else -> CameraPermissionState.NOT_REQUESTED
        }
    }
}
