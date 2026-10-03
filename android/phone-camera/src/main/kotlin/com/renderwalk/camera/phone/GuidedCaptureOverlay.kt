package com.renderwalk.camera.phone

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

/**
 * Mobile-first Jetpack Compose Overlay for 8-Point Guided Room Capture.
 * Provides real-time heading guidance (TURN LEFT / TURN RIGHT / ALIGNED),
 * progress tracking (1/8 to 8/8), retake support, and completion presentation.
 */
@Composable
fun GuidedCaptureOverlay(
    guidedManager: GuidedCaptureManager,
    onShutterClick: () -> Unit,
    onRetakeClick: () -> Unit,
    onCompleteSession: (RoomCaptureSession) -> Unit,
    misalignedWarning: String?,
    onDismissWarning: () -> Unit,
    modifier: Modifier = Modifier
) {
    val point = guidedManager.currentPoint
    val eval = guidedManager.currentEvaluation
    val isAligned = eval.state == CapturePointState.ALIGNED

    val brandOrange = Color(0xFFE07A5F)
    val alignGreen = Color(0xFF4CAF50)
    val warningAmber = Color(0xFFFFB300)

    val targetStatusColor = when {
        !eval.isGuidanceAvailable -> Color(0xFF9E9E9E)
        isAligned -> alignGreen
        else -> warningAmber
    }
    val animatedStatusColor by animateColorAsState(targetStatusColor, label = "statusColor")

    Box(modifier = modifier.fillMaxSize()) {
        if (!guidedManager.isSessionCompleted) {
            // ACTIVE 8-POINT GUIDANCE HUD

            // 1. Top Progress & Target Header
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(top = 56.dp, start = 16.dp, end = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xCC181614),
                    modifier = Modifier.padding(bottom = 8.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "NEXT POINT",
                            color = Color(0xFFAAAAAA),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Point ${point.index} of ${guidedManager.totalPoints} (${point.targetHeadingDegrees.toInt()}°)",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // 8 Segmented Progress Indicators
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    guidedManager.points.forEachIndexed { idx, p ->
                        val isDone = p.capturedPhoto != null
                        val isCurrent = idx == guidedManager.currentIndex
                        Box(
                            modifier = Modifier
                                .width(32.dp)
                                .height(5.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(
                                    when {
                                        isDone -> alignGreen
                                        isCurrent -> brandOrange
                                        else -> Color(0x66FFFFFF)
                                    }
                                )
                        )
                    }
                }
            }

            // 2. Center Direction Guidance Widget (TURN LEFT / TURN RIGHT / ALIGNED)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.Center)
                    .padding(horizontal = 24.dp),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0xDD121110),
                    border = borderWithColor(isAligned, alignGreen, Color(0x44FFFFFF)),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = when {
                                !eval.isGuidanceAvailable -> Icons.Default.Info
                                isAligned -> Icons.Default.CheckCircle
                                eval.directionText == "TURN RIGHT" -> Icons.Default.ArrowForward
                                else -> Icons.Default.ArrowBack
                            },
                            contentDescription = null,
                            tint = animatedStatusColor,
                            modifier = Modifier.size(24.dp)
                        )
                        Column {
                            Text(
                                text = eval.directionText,
                                color = animatedStatusColor,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.5.sp
                            )
                            if (eval.isGuidanceAvailable) {
                                Text(
                                    text = if (isAligned) "Ready to capture" else "${Math.abs(eval.deltaDegrees.toInt())}° away",
                                    color = Color(0xFFCCCCCC),
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }

            // 3. Misalignment Alert Toast / Banner
            if (misalignedWarning != null) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xD9C62828),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 120.dp, start = 24.dp, end = 24.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = misalignedWarning,
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(
                            onClick = onDismissWarning,
                            modifier = Modifier.size(20.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Dismiss",
                                tint = Color.White,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                }
            }

            // 4. Bottom Controls: Retake Button + Shutter Button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(bottom = 24.dp, start = 24.dp, end = 24.dp)
            ) {
                // Retake Button (left of shutter if captures exist)
                if (guidedManager.capturedCount > 0) {
                    IconButton(
                        onClick = onRetakeClick,
                        modifier = Modifier
                            .align(Alignment.CenterStart)
                            .size(50.dp)
                            .background(Color(0x66000000), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Retake point",
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }

                // Shutter Button (center)
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .size(80.dp)
                        .border(
                            width = 4.dp,
                            color = if (isAligned) alignGreen else Color.White,
                            shape = CircleShape
                        )
                        .padding(6.dp)
                        .clip(CircleShape)
                        .background(
                            when {
                                guidedManager.isCapturing -> Color.Gray
                                isAligned -> alignGreen
                                else -> Color.White
                            }
                        )
                        .clickable(enabled = !guidedManager.isCapturing) {
                            onShutterClick()
                        },
                    contentAlignment = Alignment.Center
                ) {
                    if (guidedManager.isCapturing) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 3.dp,
                            modifier = Modifier.size(32.dp)
                        )
                    } else if (isAligned) {
                        Icon(
                            imageVector = Icons.Default.CameraAlt,
                            contentDescription = "Capture Point",
                            tint = Color.White,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
            }
        } else {
            // ROOM COMPLETION SCREEN (8 of 8 Captured)
            val session = guidedManager.getSessionSummary()
            Surface(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xF0141210)),
                color = Color.Transparent
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .navigationBarsPadding()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(top = 16.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .background(Color(0x334CAF50), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = alignGreen,
                                modifier = Modifier.size(36.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "CAPTURE COMPLETE",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp,
                            letterSpacing = 1.sp
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        // Explicit truthful specification label
                        Text(
                            text = "8 captured images ready for stitching",
                            color = brandOrange,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp
                        )

                        Text(
                            text = "Stored locally in app storage. No 360 panorama synthesized yet.",
                            color = Color(0xFFAAAAAA),
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 4.dp, start = 16.dp, end = 16.dp)
                        )
                    }

                    // Gallery Strip of the 8 Real Captured Photos
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = "Captured Frames (360° Sequence):",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )

                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            items(session.points) { pt ->
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color(0xFF22201E),
                                    modifier = Modifier
                                        .width(90.dp)
                                        .height(120.dp)
                                ) {
                                    Box {
                                        pt.capturedPhoto?.file?.let { file ->
                                            AsyncImage(
                                                model = file,
                                                contentDescription = "Point ${pt.index}",
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.fillMaxSize()
                                            )
                                        }
                                        Surface(
                                            color = Color(0xCC000000),
                                            shape = RoundedCornerShape(bottomEnd = 6.dp),
                                            modifier = Modifier.align(Alignment.TopStart)
                                        ) {
                                            Text(
                                                text = "${pt.targetHeadingDegrees.toInt()}°",
                                                color = Color.White,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Actions: Retake Last Point or Accept & Finish
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                guidedManager.isReviewing = true
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
                                imageVector = Icons.Default.Visibility,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Review 8 Captured Images",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                        }

                        OutlinedButton(
                            onClick = onRetakeClick,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = null,
                                tint = Color(0xFFCCCCCC),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Retake Last Point",
                                color = Color(0xFFCCCCCC),
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun borderWithColor(isAligned: Boolean, alignColor: Color, defaultColor: Color): androidx.compose.foundation.BorderStroke {
    return androidx.compose.foundation.BorderStroke(
        width = 1.5.dp,
        color = if (isAligned) alignColor else defaultColor
    )
}
