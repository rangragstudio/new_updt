package com.renderwalk.camera.phone

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage

/**
 * Mobile-first Jetpack Compose UI for Real Phone Camera Capture.
 * Strictly presents "PHONE CAMERA" with live preview, switch, shutter, review, and retake.
 */
@Composable
fun PhoneCameraCaptureScreen(
    permissionState: CameraPermissionState,
    onRequestPermission: () -> Unit,
    onPhotoAccepted: (CapturedPhoto) -> Unit,
    onClose: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Captured photo state (triggers Review mode when non-null)
    var capturedPhoto by remember { mutableStateOf<CapturedPhoto?>(null) }
    var isCapturing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var cameraFacing by remember { mutableStateOf(CameraLensFacing.BACK) }

    // Keep reference to PreviewView and CameraXManager
    var previewViewRef by remember { mutableStateOf<PreviewView?>(null) }
    val cameraManager = remember { CameraXManager(context, lifecycleOwner) }

    // Physical Hardware Orientation & Level Sensor Manager
    val orientationManager = remember { OrientationSensorManager(context) }
    var sensorState by remember { mutableStateOf<SensorState>(SensorState.Initializing) }

    // 8-Point Guided Room Capture Manager
    val guidedCaptureManager = remember { GuidedCaptureManager() }
    var misalignedWarning by remember { mutableStateOf<String?>(null) }

    DisposableEffect(lifecycleOwner) {
        orientationManager.startListening(
            onUpdate = { orientation ->
                sensorState = SensorState.Active(orientation)
                guidedCaptureManager.onHeadingUpdated(orientation.headingDegrees)
            },
            onUnavailable = {
                sensorState = SensorState.Unavailable
                guidedCaptureManager.onHeadingUpdated(null)
            }
        )

        onDispose {
            cameraManager.shutdown()
            orientationManager.stopListening()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        when {
            // Permission State: Granted -> Show Live Camera Preview, Capture Review, or Captured Review
            permissionState == CameraPermissionState.GRANTED -> {
                if (guidedCaptureManager.isReviewing) {
                    CaptureReviewScreen(
                        guidedManager = guidedCaptureManager,
                        onSessionConfirmed = { session ->
                            session.points.firstOrNull()?.capturedPhoto?.let { photo ->
                                onPhotoAccepted(photo)
                            } ?: onClose()
                        },
                        onClose = {
                            if (guidedCaptureManager.allPointsCaptured) {
                                onClose()
                            } else {
                                guidedCaptureManager.isReviewing = false
                            }
                        }
                    )
                } else if (capturedPhoto == null) {
                    // LIVE CAMERA PREVIEW MODE
                    Box(modifier = Modifier.fillMaxSize()) {
                        // Real CameraX PreviewView
                        AndroidView(
                            factory = { ctx ->
                                PreviewView(ctx).apply {
                                    scaleType = PreviewView.ScaleType.FILL_CENTER
                                    previewViewRef = this
                                    cameraManager.startCamera(
                                        previewView = this,
                                        onInitialized = {
                                            cameraFacing = cameraManager.currentFacing
                                        },
                                        onError = { exc ->
                                            errorMessage = "Camera initialization failed: ${exc.message}"
                                        }
                                    )
                                }
                            },
                            modifier = Modifier.fillMaxSize()
                        )

                        // Real Orientation & Level Guidance Overlay over live camera preview
                        CameraLevelOverlay(
                            sensorState = sensorState,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(bottom = 120.dp)
                        )

                        // Guided 8-Point Capture Overlay (delegates to cameraManager.takePhoto when aligned)
                        GuidedCaptureOverlay(
                            guidedManager = guidedCaptureManager,
                            onShutterClick = {
                                misalignedWarning = null
                                guidedCaptureManager.attemptCapture(
                                    cameraManager = cameraManager,
                                    onPhotoSaved = { /* Real photo saved to current point */ },
                                    onMisaligned = { reason ->
                                        misalignedWarning = reason
                                    },
                                    onFailure = { exc ->
                                        errorMessage = exc
                                    }
                                )
                            },
                            onRetakeClick = {
                                guidedCaptureManager.retakeCurrentOrPreviousPoint()
                            },
                            onCompleteSession = { session ->
                                session.points.firstOrNull()?.capturedPhoto?.let { photo ->
                                    onPhotoAccepted(photo)
                                } ?: onClose()
                            },
                            misalignedWarning = misalignedWarning,
                            onDismissWarning = { misalignedWarning = null }
                        )

                        // Top Bar: Simple, Clean Phone Camera Identity (NO hardware claims)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .statusBarsPadding()
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            IconButton(
                                onClick = onClose,
                                modifier = Modifier
                                    .size(44.dp)
                                    .background(Color(0x66000000), CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Close",
                                    tint = Color.White
                                )
                            }

                            // Dedicated Header Badge: Explicitly PHONE CAMERA
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = Color(0x99181614)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Smartphone,
                                        contentDescription = null,
                                        tint = Color(0xFFE07A5F),
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Text(
                                        text = "PHONE CAMERA",
                                        color = Color.White,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 0.5.sp
                                    )
                                }
                            }

                            // Switch Camera Button (Rear <-> Front)
                            IconButton(
                                onClick = {
                                    previewViewRef?.let { pView ->
                                        cameraManager.switchCamera(pView)
                                        cameraFacing = cameraManager.currentFacing
                                    }
                                },
                                modifier = Modifier
                                    .size(44.dp)
                                    .background(Color(0x66000000), CircleShape)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.FlipCameraAndroid,
                                    contentDescription = "Switch Camera",
                                    tint = Color.White
                                )
                            }
                        }
                    }
                } else {
                    // CAPTURE REVIEW MODE (Retake vs Use Photo)
                    val photo = capturedPhoto!!
                    Box(modifier = Modifier.fillMaxSize()) {
                        // Display Captured Real Image
                        AsyncImage(
                            model = photo.file,
                            contentDescription = "Captured Photo",
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxSize()
                        )

                        // Top Bar in Review Mode
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .statusBarsPadding()
                                .padding(16.dp),
                            color = Color(0xCC000000),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text(
                                        text = "Photo Review",
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                    Text(
                                        text = "${photo.width} × ${photo.height} • ${(photo.fileSizeBytes / 1024)} KB",
                                        color = Color(0xFFAAAAAA),
                                        fontSize = 11.sp
                                    )
                                }

                                Surface(
                                    color = Color(0xFF2E7D32),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = "VALID",
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }

                        // Bottom Actions: Retake vs Use Photo
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .align(Alignment.BottomCenter)
                                .navigationBarsPadding()
                                .padding(horizontal = 24.dp, vertical = 32.dp),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // Retake Button (Discards temporary file and returns to preview)
                            Button(
                                onClick = {
                                    try {
                                        photo.file.delete()
                                    } catch (_: Exception) {}
                                    capturedPhoto = null
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF2A2826),
                                    contentColor = Color.White
                                ),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(52.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Retake",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp
                                )
                            }

                            // Use Photo Button (Accepts and returns result)
                            Button(
                                onClick = {
                                    onPhotoAccepted(photo)
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFFE07A5F),
                                    contentColor = Color.White
                                ),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(52.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Use Photo",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp
                                )
                            }
                        }
                    }
                }
            }

            // Permission Denied State
            permissionState == CameraPermissionState.DENIED -> {
                PermissionRequiredCard(
                    title = "Camera Permission Required",
                    message = "RenderWalk needs access to your device camera to capture walkthrough photos.",
                    actionLabel = "Grant Permission",
                    onAction = onRequestPermission,
                    onClose = onClose
                )
            }

            // Permanently Denied State (Open App Settings)
            permissionState == CameraPermissionState.PERMANENTLY_DENIED -> {
                PermissionRequiredCard(
                    title = "Permission Permanently Denied",
                    message = "Camera access was denied. Please open system settings and allow the Camera permission for RenderWalk.",
                    actionLabel = "Open Settings",
                    onAction = {
                        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.fromParts("package", context.packageName, null)
                        }
                        context.startActivity(intent)
                    },
                    onClose = onClose
                )
            }

            // Not Requested Yet
            else -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color(0xFFE07A5F))
                }
            }
        }

        // Error Banner
        if (errorMessage != null) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .padding(16.dp),
                color = Color(0xD9B00020),
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color.White
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = errorMessage ?: "",
                        color = Color.White,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = { errorMessage = null }) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Dismiss",
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PermissionRequiredCard(
    title: String,
    message: String,
    actionLabel: String,
    onAction: () -> Unit,
    onClose: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1C1A)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .background(Color(0x33E07A5F), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CameraAlt,
                        contentDescription = null,
                        tint = Color(0xFFE07A5F),
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = title,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = message,
                    color = Color(0xFFB0A8A0),
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = onAction,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFFE07A5F),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    Text(
                        text = actionLabel,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                TextButton(
                    onClick = onClose,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Cancel",
                        color = Color(0xFF888888)
                    )
                }
            }
        }
    }
}
