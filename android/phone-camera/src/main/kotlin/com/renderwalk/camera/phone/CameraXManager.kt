package com.renderwalk.camera.phone

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.common.util.concurrent.ListenableFuture
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

private const val TAG = "PhoneCameraX"

/**
 * CameraXManager
 * Controls real physical phone camera preview and photo capture lifecycle.
 */
class CameraXManager(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner
) {
    private var cameraProviderFuture: ListenableFuture<ProcessCameraProvider>? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageCapture: ImageCapture? = null
    private var preview: Preview? = null
    private var currentCamera: Camera? = null

    // Default to REAR camera
    var currentFacing: CameraLensFacing = CameraLensFacing.BACK
        private set

    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    /**
     * Initializes ProcessCameraProvider and binds Preview and ImageCapture use cases.
     */
    fun startCamera(
        previewView: PreviewView,
        onInitialized: (() -> Unit)? = null,
        onError: ((Throwable) -> Unit)? = null
    ) {
        cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture?.addListener({
            try {
                cameraProvider = cameraProviderFuture?.get()
                bindCameraUseCases(previewView)
                onInitialized?.invoke()
            } catch (exc: Exception) {
                Log.e(TAG, "Use case binding failed", exc)
                onError?.invoke(exc)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    /**
     * Binds CameraX Preview and ImageCapture to the given PreviewView and lifecycle owner.
     */
    fun bindCameraUseCases(previewView: PreviewView) {
        val provider = cameraProvider ?: return

        val cameraSelector = if (currentFacing == CameraLensFacing.BACK) {
            CameraSelector.DEFAULT_BACK_CAMERA
        } else {
            CameraSelector.DEFAULT_FRONT_CAMERA
        }

        // Preview usecase
        preview = Preview.Builder()
            .build()
            .also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

        // ImageCapture usecase (JPEG output with maximized quality)
        imageCapture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
            .build()

        try {
            provider.unbindAll()
            currentCamera = provider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                preview,
                imageCapture
            )
        } catch (exc: Exception) {
            Log.e(TAG, "Failed to bind camera use cases to lifecycle", exc)
            throw exc
        }
    }

    /**
     * Switches between REAR and FRONT camera.
     */
    fun switchCamera(previewView: PreviewView) {
        val provider = cameraProvider ?: return
        val targetFacing = if (currentFacing == CameraLensFacing.BACK) {
            CameraLensFacing.FRONT
        } else {
            CameraLensFacing.BACK
        }

        val targetSelector = if (targetFacing == CameraLensFacing.BACK) {
            CameraSelector.DEFAULT_BACK_CAMERA
        } else {
            CameraSelector.DEFAULT_FRONT_CAMERA
        }

        if (provider.hasCamera(targetSelector)) {
            currentFacing = targetFacing
            bindCameraUseCases(previewView)
        } else {
            Log.w(TAG, "Requested camera facing $targetFacing not available on this device")
        }
    }

    /**
     * Takes a real photo with ImageCapture and stores it into app-controlled local storage.
     */
    fun takePhoto(
        onSuccess: (CapturedPhoto) -> Unit,
        onError: (ImageCaptureException) -> Unit
    ) {
        val capture = imageCapture ?: run {
            onError(
                ImageCaptureException(
                    ImageCapture.ERROR_UNKNOWN,
                    "ImageCapture use case is not bound or initialized",
                    null
                )
            )
            return
        }

        // Dedicated app-controlled local storage directory
        val storageDir = File(context.filesDir, "phone_captures").apply {
            if (!exists()) mkdirs()
        }

        val timestamp = System.currentTimeMillis()
        val dateString = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date(timestamp))
        val randomSuffix = UUID.randomUUID().toString().take(6)
        val photoFile = File(storageDir, "PHONE_${dateString}_${randomSuffix}.jpg")

        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        capture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    val savedUri = output.savedUri ?: Uri.fromFile(photoFile)

                    // Verify image integrity on disk
                    val validation = CapturedImageValidator.validate(photoFile)
                    if (validation is ValidationResult.Invalid) {
                        Log.e(TAG, "Captured image failed validation: ${validation.reason}")
                        photoFile.delete() // Clean up invalid file
                        ContextCompat.getMainExecutor(context).execute {
                            onError(
                                ImageCaptureException(
                                    ImageCapture.ERROR_FILE_IO,
                                    "Image validation failed: ${validation.reason}",
                                    null
                                )
                            )
                        }
                        return
                    }

                    // Decode dimensions
                    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    BitmapFactory.decodeFile(photoFile.absolutePath, bounds)

                    val capturedPhoto = CapturedPhoto(
                        file = photoFile,
                        uri = savedUri,
                        width = bounds.outWidth,
                        height = bounds.outHeight,
                        fileSizeBytes = photoFile.length(),
                        captureTimestamp = timestamp,
                        facing = currentFacing
                    )

                    ContextCompat.getMainExecutor(context).execute {
                        onSuccess(capturedPhoto)
                    }
                }

                override fun onError(exc: ImageCaptureException) {
                    Log.e(TAG, "Photo capture failed: ${exc.message}", exc)
                    ContextCompat.getMainExecutor(context).execute {
                        onError(exc)
                    }
                }
            }
        )
    }

    /**
     * Unbinds use cases and frees camera resources.
     */
    fun shutdown() {
        try {
            cameraProvider?.unbindAll()
            cameraExecutor.shutdown()
        } catch (e: Exception) {
            Log.e(TAG, "Error during CameraX shutdown", e)
        }
    }
}
