package com.renderwalk.camera.phone

/**
 * Status of the phone's horizontal tilt (roll).
 */
enum class RollStatus {
    LEVEL,
    TILTED_LEFT,
    TILTED_RIGHT
}

/**
 * Status of the phone's vertical inclination (pitch).
 */
enum class PitchStatus {
    LEVEL,
    TILTED_UP,
    TILTED_DOWN
}

/**
 * Real orientation readings and evaluation data computed from physical device sensors.
 */
data class OrientationData(
    val rollDegrees: Float,       // Negative = tilted left, positive = tilted right
    val pitchDegrees: Float,      // Degrees relative to vertical upright orientation
    val headingDegrees: Float? = null, // Compass azimuth [0, 360) degrees from true/magnetic north if available
    val isLevel: Boolean,         // True if both roll and pitch are within tolerances
    val rollStatus: RollStatus,
    val pitchStatus: PitchStatus,
    val guidanceMessage: String,  // e.g. "LEVEL", "TILT RIGHT", "TILT LEFT", "TILT DOWN", "TILT UP"
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Sensor availability and runtime lifecycle states.
 */
sealed class SensorState {
    object Initializing : SensorState()
    object Unavailable : SensorState() // Emitted if no orientation/gravity/accelerometer hardware is present
    data class Active(val orientation: OrientationData) : SensorState()
}

/**
 * Orientation calculation engine with configurable tolerances and smoothing.
 */
object OrientationCalculator {
    const val ROLL_TOLERANCE_DEG = 3.0f   // +/- 3 degrees for horizontal level
    const val PITCH_TOLERANCE_DEG = 6.0f  // +/- 6 degrees for vertical upright alignment

    /**
     * Evaluates roll, pitch, and optional heading into structured orientation status.
     * Pure function for deterministic testing and hardware evaluation.
     */
    fun evaluate(
        rollDegrees: Float,
        pitchDegrees: Float,
        headingDegrees: Float? = null
    ): OrientationData {
        val rollStatus = when {
            rollDegrees < -ROLL_TOLERANCE_DEG -> RollStatus.TILTED_LEFT
            rollDegrees > ROLL_TOLERANCE_DEG -> RollStatus.TILTED_RIGHT
            else -> RollStatus.LEVEL
        }

        val pitchStatus = when {
            pitchDegrees < -PITCH_TOLERANCE_DEG -> PitchStatus.TILTED_UP
            pitchDegrees > PITCH_TOLERANCE_DEG -> PitchStatus.TILTED_DOWN
            else -> PitchStatus.LEVEL
        }

        val isLevel = (rollStatus == RollStatus.LEVEL && pitchStatus == PitchStatus.LEVEL)

        val guidanceMessage = when {
            isLevel -> "LEVEL"
            rollStatus == RollStatus.TILTED_LEFT -> "TILT RIGHT"
            rollStatus == RollStatus.TILTED_RIGHT -> "TILT LEFT"
            pitchStatus == PitchStatus.TILTED_UP -> "TILT DOWN"
            pitchStatus == PitchStatus.TILTED_DOWN -> "TILT UP"
            else -> "ADJUST PHONE"
        }

        return OrientationData(
            rollDegrees = rollDegrees,
            pitchDegrees = pitchDegrees,
            headingDegrees = headingDegrees,
            isLevel = isLevel,
            rollStatus = rollStatus,
            pitchStatus = pitchStatus,
            guidanceMessage = guidanceMessage
        )
    }

    /**
     * Applies standard low-pass exponential smoothing to damp high-frequency hand jitter.
     */
    fun smooth(current: Float, target: Float, alpha: Float = 0.25f): Float {
        return current + alpha * (target - current)
    }
}
