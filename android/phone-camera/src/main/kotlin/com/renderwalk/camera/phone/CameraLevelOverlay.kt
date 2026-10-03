package com.renderwalk.camera.phone

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlin.math.min

/**
 * Visual Level and Orientation Overlay for Real Phone Camera Preview.
 * Provides real-time horizontal (roll) and vertical (pitch) level guidance.
 */
@Composable
fun CameraLevelOverlay(
    sensorState: SensorState,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        when (sensorState) {
            is SensorState.Active -> {
                val orientation = sensorState.orientation

                // Visual theme colors
                val levelGreen = Color(0xFF4CAF50)
                val adjustAmber = Color(0xFFFFB300)

                val targetColor = if (orientation.isLevel) levelGreen else adjustAmber
                val animatedColor by animateColorAsState(targetColor, label = "levelColor")

                // Animate horizontal roll offset smoothly (-60dp to +60dp clamped)
                // rollDegrees positive = tilted right -> bubble/dot moves right
                val rawOffsetRatio = (orientation.rollDegrees / 20.0f).coerceIn(-1.0f, 1.0f)
                val animatedOffsetRatio by animateFloatAsState(
                    targetValue = rawOffsetRatio,
                    animationSpec = spring(dampingRatio = 0.8f, stiffness = 300f),
                    label = "bubbleOffset"
                )

                // Animate vertical pitch offset (-20dp to +20dp clamped)
                val rawPitchRatio = (orientation.pitchDegrees / 30.0f).coerceIn(-1.0f, 1.0f)
                val animatedPitchRatio by animateFloatAsState(
                    targetValue = rawPitchRatio,
                    animationSpec = spring(dampingRatio = 0.8f, stiffness = 300f),
                    label = "pitchOffset"
                )

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    // Horizon Line with Center Reticle & Dynamic Level Dot: ───●───
                    Box(
                        modifier = Modifier
                            .width(180.dp)
                            .height(50.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val centerY = size.height / 2f
                            val centerX = size.width / 2f
                            val lineWidth = size.width

                            // 1. Reference Horizon Center Line (dim white)
                            drawLine(
                                color = Color(0x66FFFFFF),
                                start = Offset(0f, centerY),
                                end = Offset(lineWidth, centerY),
                                strokeWidth = 2.dp.toPx(),
                                cap = StrokeCap.Round
                            )

                            // 2. Center Target Crosshairs / Alignment Goal
                            val targetBracketRadius = 8.dp.toPx()
                            drawLine(
                                color = Color(0x99FFFFFF),
                                start = Offset(centerX - targetBracketRadius, centerY - 6.dp.toPx()),
                                end = Offset(centerX - targetBracketRadius, centerY + 6.dp.toPx()),
                                strokeWidth = 2.dp.toPx()
                            )
                            drawLine(
                                color = Color(0x99FFFFFF),
                                start = Offset(centerX + targetBracketRadius, centerY - 6.dp.toPx()),
                                end = Offset(centerX + targetBracketRadius, centerY + 6.dp.toPx()),
                                strokeWidth = 2.dp.toPx()
                            )

                            // 3. Dynamic Bubble / Level Indicator (colored by alignment)
                            val maxTravelPx = 60.dp.toPx()
                            val bubbleX = centerX + (animatedOffsetRatio * maxTravelPx)
                            val maxPitchTravelPx = 15.dp.toPx()
                            val bubbleY = centerY + (animatedPitchRatio * maxPitchTravelPx)

                            // Outer glow circle
                            drawCircle(
                                color = animatedColor.copy(alpha = 0.35f),
                                radius = 9.dp.toPx(),
                                center = Offset(bubbleX, bubbleY)
                            )
                            // Solid center dot
                            drawCircle(
                                color = animatedColor,
                                radius = 5.dp.toPx(),
                                center = Offset(bubbleX, bubbleY)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    // Guidance Text Badge: e.g. "LEVEL" or "TILT RIGHT" / "ADJUST PHONE"
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xCC181614)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .background(animatedColor, RoundedCornerShape(4.dp))
                            )
                            Text(
                                text = orientation.guidanceMessage,
                                color = animatedColor,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.5.sp
                            )
                        }
                    }
                }
            }

            is SensorState.Unavailable -> {
                // Discreet badge when physical orientation sensors are missing on device
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xCC2A2624),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null,
                            tint = Color(0xFFB0A8A0),
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "Orientation sensor unavailable",
                            color = Color(0xFFB0A8A0),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            is SensorState.Initializing -> {
                // Subtle initializing state while sensor registers
            }
        }
    }
}
