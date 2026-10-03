package com.renderwalk.camera.phone

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import java.text.SimpleDateFormat
import java.util.*

/**
 * CaptureReviewScreen
 * Provides complete local capture review for the 8-point room sequence:
 * - 8-point thumbnail grid with genuine metadata (point number, heading, resolution)
 * - Real-time upload status badge per point (Uploading, Uploaded, Waiting for connection, Upload failed)
 * - Full-image modal preview with detailed inspection and retry
 * - Retake-any-point workflow
 * - Strict capture set validation before confirmation (READY_FOR_STITCHING / READY_FOR_PROCESSING)
 * - Safe session discard with confirmation dialog
 */
@Composable
fun CaptureReviewScreen(
    guidedManager: GuidedCaptureManager,
    onSessionConfirmed: (RoomCaptureSession) -> Unit,
    onClose: () -> Unit
) {
    val brandOrange = Color(0xFFE07A5F)
    val successGreen = Color(0xFF4CAF50)
    val warningRed = Color(0xFFD32F2F)
    val warningAmber = Color(0xFFFFB300)

    var showDiscardDialog by remember { mutableStateOf(false) }
    var validationErrors by remember { mutableStateOf<List<String>?>(null) }
    val allUploaded = guidedManager.allUploaded
    val isReadyForProcessing = guidedManager.sessionStatus == SessionStatus.READY_FOR_PROCESSING || allUploaded
    val isConfirmedReady = guidedManager.sessionStatus == SessionStatus.READY_FOR_STITCHING || isReadyForProcessing

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF141210))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            // Header Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onClose,
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.White
                    )
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "CAPTURE REVIEW",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "${guidedManager.capturedCount} of ${guidedManager.totalPoints} Captured • ${guidedManager.uploadedCount} Uploaded",
                        color = Color(0xFFAAAAAA),
                        fontSize = 11.sp
                    )
                }

                TextButton(
                    onClick = { showDiscardDialog = true }
                ) {
                    Text(
                        text = "Discard",
                        color = Color(0xFFE57373),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            // Upload Status Banners (Customer-facing, no internal credentials or storage details)
            when {
                isReadyForProcessing -> {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0x334CAF50),
                        border = androidx.compose.foundation.BorderStroke(1.dp, successGreen),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = successGreen,
                                modifier = Modifier.size(24.dp)
                            )
                            Column {
                                Text(
                                    text = "Upload complete",
                                    color = successGreen,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                                Text(
                                    text = "Ready for processing",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                                Text(
                                    text = "All required source images are safely available on the server.",
                                    color = Color(0xFFDDDDDD),
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }

                guidedManager.isUploadingAny -> {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0x33FFB300),
                        border = androidx.compose.foundation.BorderStroke(1.dp, warningAmber),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                color = warningAmber,
                                strokeWidth = 2.dp
                            )
                            Text(
                                text = "Uploading your capture set... (${guidedManager.uploadedCount}/${guidedManager.totalPoints} uploaded)",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }

                guidedManager.hasFailedUploads -> {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0x33D32F2F),
                        border = androidx.compose.foundation.BorderStroke(1.dp, warningRed),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Upload failed",
                                color = Color(0xFFFFCDD2),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                            TextButton(
                                onClick = { guidedManager.retryAllFailedUploads() }
                            ) {
                                Text(
                                    text = "Retry upload",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }

                isConfirmedReady -> {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0x334CAF50),
                        border = androidx.compose.foundation.BorderStroke(1.dp, successGreen),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = successGreen,
                                modifier = Modifier.size(24.dp)
                            )
                            Column {
                                Text(
                                    text = "READY_FOR_STITCHING",
                                    color = successGreen,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                                Text(
                                    text = "8 valid local images are ready for the future stitching pipeline.",
                                    color = Color(0xFFDDDDDD),
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }

            // 8-Point Thumbnail Grid (2 columns x 4 rows)
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                items(guidedManager.points) { pt ->
                    CapturePointCard(
                        point = pt,
                        onInspect = { guidedManager.selectedPreviewPoint = pt },
                        onRetake = { guidedManager.selectPointForRetake(pt.index) },
                        onRetryUpload = { guidedManager.retryUpload(pt.index) }
                    )
                }
            }

            // Bottom Actions: Confirm vs Return
            Spacer(modifier = Modifier.height(12.dp))

            if (!isConfirmedReady) {
                Button(
                    onClick = {
                        val result = guidedManager.confirmCaptureSet()
                        if (result is CaptureSetValidationResult.Valid) {
                            validationErrors = null
                        } else if (result is CaptureSetValidationResult.Invalid) {
                            validationErrors = result.errors
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = brandOrange,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "CONFIRM CAPTURE SET",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            } else {
                Button(
                    onClick = {
                        onSessionConfirmed(guidedManager.getSessionSummary())
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = successGreen,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    Text(
                        text = if (isReadyForProcessing) "Ready for Processing" else "Accept 8 Captured Images",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            }
        }

        // Full Image Preview Modal Dialog
        guidedManager.selectedPreviewPoint?.let { inspectedPoint ->
            FullImagePreviewDialog(
                point = inspectedPoint,
                onClose = { guidedManager.selectedPreviewPoint = null },
                onRetake = {
                    guidedManager.selectPointForRetake(inspectedPoint.index)
                },
                onRetryUpload = {
                    guidedManager.retryUpload(inspectedPoint.index)
                }
            )
        }

        // Discard Confirmation Dialog
        if (showDiscardDialog) {
            AlertDialog(
                onDismissRequest = { showDiscardDialog = false },
                title = {
                    Text(
                        text = "Discard All Captures?",
                        fontWeight = FontWeight.Bold
                    )
                },
                text = {
                    Text("This will permanently delete all temporary captured JPEG files and reset the capture sequence. Unrelated files will not be touched.")
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showDiscardDialog = false
                            guidedManager.discardSession()
                            onClose()
                        }
                    ) {
                        Text(
                            text = "Discard All",
                            color = warningRed,
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDiscardDialog = false }) {
                        Text("Keep Captures")
                    }
                },
                containerColor = Color(0xFF221F1D),
                titleContentColor = Color.White,
                textContentColor = Color(0xFFDDDDDD)
            )
        }

        // Validation Failure Dialog
        validationErrors?.let { errors ->
            AlertDialog(
                onDismissRequest = { validationErrors = null },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Error,
                            contentDescription = null,
                            tint = warningRed
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Capture Set Incomplete",
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "Please resolve the following issues before confirming:",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFFAAAAAA)
                        )
                        errors.forEach { err ->
                            Text(
                                text = "• $err",
                                fontSize = 12.sp,
                                color = Color.White
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = { validationErrors = null },
                        colors = ButtonDefaults.buttonColors(containerColor = brandOrange)
                    ) {
                        Text("Review Points")
                    }
                },
                containerColor = Color(0xFF221F1D),
                titleContentColor = Color.White,
                textContentColor = Color.White
            )
        }
    }
}

/**
 * Thumbnail card representing one capture point in the 8-point grid.
 */
@Composable
private fun CapturePointCard(
    point: CapturePoint,
    onInspect: () -> Unit,
    onRetake: () -> Unit,
    onRetryUpload: () -> Unit
) {
    val photo = point.capturedPhoto
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Color(0xFF201D1B),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33FFFFFF)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(8.dp)) {
            // Header: Point Number & Target Heading
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Point ${point.index}",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp
                )
                Text(
                    text = "${point.targetHeadingDegrees.toInt()}°",
                    color = Color(0xFFE07A5F),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Thumbnail (uses Coil AsyncImage with fit/crop for fast review)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(96.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF100E0D))
                    .clickable(enabled = photo != null) { onInspect() },
                contentAlignment = Alignment.Center
            ) {
                if (photo != null) {
                    AsyncImage(
                        model = photo.file,
                        contentDescription = "Point ${point.index} Preview",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.CameraAlt,
                            contentDescription = null,
                            tint = Color(0xFF666666),
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = "Not Captured",
                            color = Color(0xFF888888),
                            fontSize = 10.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Upload Status Badge (Customer-facing)
            if (photo != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    when (point.uploadState) {
                        UploadState.UPLOADED -> {
                            Text(
                                text = "✓ Uploaded",
                                color = Color(0xFF81C784),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        UploadState.UPLOADING -> {
                            Text(
                                text = "↻ Uploading",
                                color = Color(0xFFFFB300),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                        UploadState.PENDING -> {
                            Text(
                                text = "Waiting for connection",
                                color = Color(0xFFB0BEC5),
                                fontSize = 10.sp
                            )
                        }
                        UploadState.FAILED -> {
                            Text(
                                text = "Upload failed",
                                color = Color(0xFFEF5350),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Retry",
                                color = Color(0xFFE07A5F),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.clickable { onRetryUpload() }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Footer: Resolution & Retake Action
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (photo != null) {
                    Text(
                        text = "${photo.width}×${photo.height}",
                        color = Color(0xFFAAAAAA),
                        fontSize = 10.sp
                    )
                } else {
                    Text(
                        text = "Pending",
                        color = Color(0xFFFFB300),
                        fontSize = 10.sp
                    )
                }

                TextButton(
                    onClick = onRetake,
                    contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
                    modifier = Modifier.height(26.dp)
                ) {
                    Text(
                        text = "Retake",
                        color = Color(0xFFE07A5F),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

/**
 * Full-screen modal image preview allowing inspection and point retake.
 */
@Composable
private fun FullImagePreviewDialog(
    point: CapturePoint,
    onClose: () -> Unit,
    onRetake: () -> Unit,
    onRetryUpload: () -> Unit
) {
    val photo = point.capturedPhoto ?: return
    val formattedDate = remember(point.captureTimestamp) {
        val ts = point.captureTimestamp ?: photo.captureTimestamp
        SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(ts))
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Color.Black
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                // Full High-Resolution Real Photo
                AsyncImage(
                    model = photo.file,
                    contentDescription = "Full Preview Point ${point.index}",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize()
                )

                // Top Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = onClose,
                        modifier = Modifier
                            .size(44.dp)
                            .background(Color(0x88000000), RoundedCornerShape(22.dp))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = Color.White
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xCC181614)
                    ) {
                        Text(
                            text = "Point ${point.index} of 8 (${point.targetHeadingDegrees.toInt()}°)",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }

                // Bottom Metadata, Upload State, & Retake Bar
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(16.dp),
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xDD1E1C1A)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = "Resolution: ${photo.width} × ${photo.height}",
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = "File Size: ${photo.fileSizeBytes / 1024} KB",
                                    color = Color(0xFFAAAAAA),
                                    fontSize = 11.sp
                                )
                                // Upload status text
                                Text(
                                    text = when (point.uploadState) {
                                        UploadState.UPLOADED -> "Status: Uploaded"
                                        UploadState.UPLOADING -> "Status: Uploading..."
                                        UploadState.PENDING -> "Status: Waiting for connection"
                                        UploadState.FAILED -> "Status: Upload failed"
                                    },
                                    color = when (point.uploadState) {
                                        UploadState.UPLOADED -> Color(0xFF81C784)
                                        UploadState.UPLOADING -> Color(0xFFFFB300)
                                        UploadState.PENDING -> Color(0xFFB0BEC5)
                                        UploadState.FAILED -> Color(0xFFEF5350)
                                    },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "Heading: ${point.actualHeadingDegrees?.toInt() ?: point.targetHeadingDegrees.toInt()}°",
                                    color = Color(0xFFE07A5F),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = formattedDate,
                                    color = Color(0xFFAAAAAA),
                                    fontSize = 10.sp
                                )
                                if (point.uploadState == UploadState.FAILED) {
                                    TextButton(
                                        onClick = onRetryUpload,
                                        contentPadding = PaddingValues(0.dp)
                                    ) {
                                        Text(
                                            text = "Retry upload",
                                            color = Color(0xFFE07A5F),
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = onRetake,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFE07A5F),
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Retake This Point",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
