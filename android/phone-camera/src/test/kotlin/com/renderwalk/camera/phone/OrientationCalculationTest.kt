package com.renderwalk.camera.phone

import org.junit.Assert.*
import org.junit.Test

class OrientationCalculationTest {

    @Test
    fun testPerfectAlignment() {
        val orientation = OrientationCalculator.evaluate(0.0f, 0.0f)
        assertTrue(orientation.isLevel)
        assertEquals(RollStatus.LEVEL, orientation.rollStatus)
        assertEquals(PitchStatus.LEVEL, orientation.pitchStatus)
        assertEquals("LEVEL", orientation.guidanceMessage)
    }

    @Test
    fun testWithinToleranceLevel() {
        // Roll within +/- 3 deg, Pitch within +/- 6 deg
        val orientation = OrientationCalculator.evaluate(2.1f, -4.5f)
        assertTrue(orientation.isLevel)
        assertEquals(RollStatus.LEVEL, orientation.rollStatus)
        assertEquals(PitchStatus.LEVEL, orientation.pitchStatus)
        assertEquals("LEVEL", orientation.guidanceMessage)
    }

    @Test
    fun testTiltLeftDetection() {
        // Roll < -3.0 deg -> Tilted Left -> User needs to "TILT RIGHT"
        val orientation = OrientationCalculator.evaluate(-8.5f, 1.0f)
        assertFalse(orientation.isLevel)
        assertEquals(RollStatus.TILTED_LEFT, orientation.rollStatus)
        assertEquals(PitchStatus.LEVEL, orientation.pitchStatus)
        assertEquals("TILT RIGHT", orientation.guidanceMessage)
    }

    @Test
    fun testTiltRightDetection() {
        // Roll > +3.0 deg -> Tilted Right -> User needs to "TILT LEFT"
        val orientation = OrientationCalculator.evaluate(12.0f, 0.0f)
        assertFalse(orientation.isLevel)
        assertEquals(RollStatus.TILTED_RIGHT, orientation.rollStatus)
        assertEquals(PitchStatus.LEVEL, orientation.pitchStatus)
        assertEquals("TILT LEFT", orientation.guidanceMessage)
    }

    @Test
    fun testTiltUpDetection() {
        // Pitch < -6.0 deg -> Pointing Up -> User needs to "TILT DOWN"
        val orientation = OrientationCalculator.evaluate(0.5f, -14.0f)
        assertFalse(orientation.isLevel)
        assertEquals(RollStatus.LEVEL, orientation.rollStatus)
        assertEquals(PitchStatus.TILTED_UP, orientation.pitchStatus)
        assertEquals("TILT DOWN", orientation.guidanceMessage)
    }

    @Test
    fun testTiltDownDetection() {
        // Pitch > +6.0 deg -> Pointing Down -> User needs to "TILT UP"
        val orientation = OrientationCalculator.evaluate(1.0f, 18.0f)
        assertFalse(orientation.isLevel)
        assertEquals(RollStatus.LEVEL, orientation.rollStatus)
        assertEquals(PitchStatus.TILTED_DOWN, orientation.pitchStatus)
        assertEquals("TILT UP", orientation.guidanceMessage)
    }

    @Test
    fun testSmoothingFilter() {
        var current = 0.0f
        val target = 10.0f

        // One step with alpha 0.25: 0 + 0.25 * 10 = 2.5
        current = OrientationCalculator.smooth(current, target, alpha = 0.25f)
        assertEquals(2.5f, current, 0.01f)

        // Second step: 2.5 + 0.25 * (10 - 2.5) = 2.5 + 1.875 = 4.375
        current = OrientationCalculator.smooth(current, target, alpha = 0.25f)
        assertEquals(4.375f, current, 0.01f)
    }
}
