package com.renderwalk.camera.phone

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*

class PhoneCameraActivity : ComponentActivity() {

    private var permissionState by mutableStateOf(CameraPermissionState.NOT_REQUESTED)

    // Runtime Permission Request Contract
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        permissionState = if (isGranted) {
            CameraPermissionState.GRANTED
        } else {
            CameraPermissionHelper.getPermissionState(this)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Evaluate initial permission
        checkAndUpdatePermission()

        setContent {
            PhoneCameraCaptureScreen(
                permissionState = permissionState,
                onRequestPermission = {
                    requestPermissionLauncher.launch(CameraPermissionHelper.CAMERA_PERMISSION)
                },
                onPhotoAccepted = { capturedPhoto ->
                    // Return result to caller without creating a RenderWalk scan yet
                    val resultIntent = Intent().apply {
                        data = capturedPhoto.uri
                        putExtra(EXTRA_FILE_PATH, capturedPhoto.file.absolutePath)
                        putExtra(EXTRA_WIDTH, capturedPhoto.width)
                        putExtra(EXTRA_HEIGHT, capturedPhoto.height)
                        putExtra(EXTRA_TIMESTAMP, capturedPhoto.captureTimestamp)
                        putExtra(EXTRA_FILE_SIZE, capturedPhoto.fileSizeBytes)
                    }
                    setResult(Activity.RESULT_OK, resultIntent)
                    finish()
                },
                onClose = {
                    setResult(Activity.RESULT_CANCELED)
                    finish()
                }
            )
        }
    }

    override fun onResume() {
        super.onResume()
        checkAndUpdatePermission()
    }

    private fun checkAndUpdatePermission() {
        permissionState = if (CameraPermissionHelper.hasCameraPermission(this)) {
            CameraPermissionState.GRANTED
        } else {
            CameraPermissionHelper.getPermissionState(this)
        }
    }

    companion object {
        const val EXTRA_FILE_PATH = "extra_captured_file_path"
        const val EXTRA_WIDTH = "extra_captured_width"
        const val EXTRA_HEIGHT = "extra_captured_height"
        const val EXTRA_TIMESTAMP = "extra_captured_timestamp"
        const val EXTRA_FILE_SIZE = "extra_captured_file_size"
    }
}
