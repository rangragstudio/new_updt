package com.renderwalk.camera.phone

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import android.view.Surface
import android.view.WindowManager
import kotlin.math.atan2
import kotlin.math.pow
import kotlin.math.sqrt

private const val TAG = "PhoneOrientationSensor"

/**
 * OrientationSensorManager
 * Connects directly to Android physical hardware sensors (Rotation Vector, Gravity, Accelerometer).
 * Computes roll (horizontal tilt) and pitch (vertical tilt) without artificial or simulated feeds.
 */
class OrientationSensorManager(private val context: Context) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private var activeSensor: Sensor? = null

    // Callbacks for live orientation updates and unavailable sensor state
    private var onOrientationChanged: ((OrientationData) -> Unit)? = null
    private var onSensorUnavailable: (() -> Unit)? = null

    private var isListening = false

    // Smooth filter buffers
    private var smoothedRoll = 0.0f
    private var smoothedPitch = 0.0f
    private var smoothedHeading: Float? = null
    private var hasFirstSample = false

    // Buffers for matrix calculations (reused to avoid allocation in hot sensor path)
    private val rotationMatrix = FloatArray(9)
    private val remappedMatrix = FloatArray(9)
    private val orientationAngles = FloatArray(3)

    init {
        // Hardware sensor selection: Prefer ROTATION_VECTOR -> GRAVITY -> ACCELEROMETER
        activeSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
            ?: sensorManager?.getDefaultSensor(Sensor.TYPE_GRAVITY)
            ?: sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    }

    /**
     * Checks if the physical device has a suitable orientation or accelerometer sensor.
     */
    fun isHardwareAvailable(): Boolean {
        return activeSensor != null && sensorManager != null
    }

    /**
     * Registers hardware sensor listener with SENSOR_DELAY_UI for smooth 60fps UI feedback.
     */
    fun startListening(
        onUpdate: (OrientationData) -> Unit,
        onUnavailable: () -> Unit
    ) {
        this.onOrientationChanged = onUpdate
        this.onSensorUnavailable = onUnavailable

        if (!isHardwareAvailable()) {
            Log.w(TAG, "No suitable orientation or gravity hardware sensor found on device")
            onUnavailable()
            return
        }

        if (isListening) return

        hasFirstSample = false
        val registered = sensorManager?.registerListener(
            this,
            activeSensor,
            SensorManager.SENSOR_DELAY_UI
        ) ?: false

        if (!registered) {
            Log.e(TAG, "Failed to register sensor listener with Android SensorManager")
            onUnavailable()
            return
        }

        isListening = true
    }

    /**
     * Unregisters sensor listener to prevent battery drain and memory leaks.
     */
    fun stopListening() {
        if (!isListening) return
        try {
            sensorManager?.unregisterListener(this)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering sensor listener", e)
        } finally {
            isListening = false
            onOrientationChanged = null
            onSensorUnavailable = null
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || !isListening) return

        var rawRoll = 0.0f
        var rawPitch = 0.0f
        var rawHeading: Float? = null

        when (event.sensor.type) {
            Sensor.TYPE_ROTATION_VECTOR -> {
                SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)

                // Remap coordinates according to default portrait display orientation
                SensorManager.remapCoordinateSystem(
                    rotationMatrix,
                    SensorManager.AXIS_X,
                    SensorManager.AXIS_Z,
                    remappedMatrix
                )

                SensorManager.getOrientation(remappedMatrix, orientationAngles)

                // Convert radians to degrees
                // orientationAngles[0] = azimuth (heading), orientationAngles[1] = pitch, orientationAngles[2] = roll
                val headingRad = orientationAngles[0]
                val pitchRad = orientationAngles[1]
                val rollRad = orientationAngles[2]

                rawHeading = ((Math.toDegrees(headingRad.toDouble()).toFloat() + 360f) % 360f)
                rawPitch = Math.toDegrees(pitchRad.toDouble()).toFloat()
                rawRoll = Math.toDegrees(rollRad.toDouble()).toFloat()
            }

            Sensor.TYPE_GRAVITY, Sensor.TYPE_ACCELEROMETER -> {
                val ax = event.values[0]
                val ay = event.values[1]
                val az = event.values[2]

                // Standard roll and pitch calculation from gravity acceleration vectors
                // Roll: tilt left / right around Y axis
                val rollRad = atan2(-ax.toDouble(), sqrt(ay.toDouble().pow(2) + az.toDouble().pow(2)))
                // Pitch: tilt forward / backward relative to upright phone (ay ~ 9.8)
                val pitchRad = atan2(az.toDouble(), ay.toDouble())

                rawRoll = Math.toDegrees(rollRad).toFloat()
                rawPitch = Math.toDegrees(pitchRad).toFloat()
                rawHeading = null // Heading not determinable from gravity alone
            }

            else -> return
        }

        // Apply low-pass filter to dampen hand tremor without lag
        if (!hasFirstSample) {
            smoothedRoll = rawRoll
            smoothedPitch = rawPitch
            smoothedHeading = rawHeading
            hasFirstSample = true
        } else {
            smoothedRoll = OrientationCalculator.smooth(smoothedRoll, rawRoll, alpha = 0.25f)
            smoothedPitch = OrientationCalculator.smooth(smoothedPitch, rawPitch, alpha = 0.25f)
            if (rawHeading != null) {
                val prev = smoothedHeading ?: rawHeading
                val delta = (rawHeading - prev + 540f) % 360f - 180f
                smoothedHeading = (prev + delta * 0.25f + 360f) % 360f
            } else {
                smoothedHeading = null
            }
        }

        val orientation = OrientationCalculator.evaluate(smoothedRoll, smoothedPitch, smoothedHeading)
        onOrientationChanged?.invoke(orientation)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No-op for level guidance
    }
}
