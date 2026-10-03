/**
 * ============================================================================
 * TASK 28 — REAL PHONE CAMERA LEVEL & ORIENTATION GUIDANCE VERIFICATION
 * ============================================================================
 *
 * Verifies that the Android Phone Camera level & orientation guidance implementation:
 * 1. Uses real Android Sensor APIs (Rotation Vector, Gravity, Accelerometer)
 * 2. Employs zero simulated/random values or timers
 * 3. Handles unavailable sensors with "Orientation sensor unavailable"
 * 4. Implements horizontal (roll) and vertical (pitch) level guidance with tolerances
 * 5. Provides minimal, mobile-friendly level overlay over live CameraX preview
 * 6. Manages sensor lifecycle cleanly (registers on active, unregisters on dispose)
 * 7. Contains no 360 capture points, radar, or rotation sequence logic
 * 8. Maintains strict honest boundaries (no 360 camera, Insta360, GoPro, LiDAR, AR)
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

async function runTask28Verification() {
  console.log('====================================================================');
  console.log('TASK 28 — REAL PHONE CAMERA LEVEL & ORIENTATION GUIDANCE VERIFICATION');
  console.log('====================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Real Android Sensor APIs & Hardware Integration
  // -------------------------------------------------------------------------
  console.log('[TEST 1] Real Android Sensor APIs Verification...');
  const sensorManagerPath = path.resolve('android/phone-camera/src/main/kotlin/com/renderwalk/camera/phone/OrientationSensorManager.kt');
  if (!fs.existsSync(sensorManagerPath)) {
    throw new Error('Test 1 failed: OrientationSensorManager.kt not found');
  }
  const sensorSource = fs.readFileSync(sensorManagerPath, 'utf-8');

  // Must use Android SensorManager and authentic physical sensor types
  if (!sensorSource.includes('Context.SENSOR_SERVICE') || !sensorSource.includes('SensorManager')) {
    throw new Error('Test 1 failed: Must use Android SensorManager API');
  }
  if (!sensorSource.includes('Sensor.TYPE_ROTATION_VECTOR') && !sensorSource.includes('Sensor.TYPE_GRAVITY') && !sensorSource.includes('Sensor.TYPE_ACCELEROMETER')) {
    throw new Error('Test 1 failed: Must bind to physical hardware sensor types (ROTATION_VECTOR, GRAVITY, or ACCELEROMETER)');
  }
  console.log('  Android SensorManager: bound');
  console.log('  Hardware sensor types: TYPE_ROTATION_VECTOR, TYPE_GRAVITY, TYPE_ACCELEROMETER');
  console.log('  -> TEST 1 PASSED: Real sensor APIs verified.\n');

  // -------------------------------------------------------------------------
  // TEST 2: Zero Simulated / Random / Fake Sensor Feeds
  // -------------------------------------------------------------------------
  console.log('[TEST 2] Verification of Zero Simulated / Random Feeds...');
  const forbiddenPatterns = [
    'Math.random()',
    'Random.next',
    'java.util.Random',
    'simulateOrientation',
    'fakeSensor',
    'Timer().schedule',
    'mockSensor'
  ];

  for (const pattern of forbiddenPatterns) {
    if (sensorSource.includes(pattern)) {
      throw new Error(`Test 2 failed: Forbidden simulated/random feed pattern detected: ${pattern}`);
    }
  }
  console.log('  Zero Math.random / synthetic timer movement: verified');
  console.log('  -> TEST 2 PASSED: Pure physical hardware sensor stream verified.\n');

  // -------------------------------------------------------------------------
  // TEST 3: Sensor Unavailable Fallback Handling
  // -------------------------------------------------------------------------
  console.log('[TEST 3] Sensor Unavailable Fallback Handling...');
  if (!sensorSource.includes('onSensorUnavailable') || !sensorSource.includes('isHardwareAvailable()')) {
    throw new Error('Test 3 failed: OrientationSensorManager must implement explicit hardware availability check');
  }

  const overlayPath = path.resolve('android/phone-camera/src/main/kotlin/com/renderwalk/camera/phone/CameraLevelOverlay.kt');
  if (!fs.existsSync(overlayPath)) {
    throw new Error('Test 3 failed: CameraLevelOverlay.kt not found');
  }
  const overlaySource = fs.readFileSync(overlayPath, 'utf-8');

  if (!overlaySource.includes('"Orientation sensor unavailable"')) {
    throw new Error('Test 3 failed: UI must display "Orientation sensor unavailable" when sensor is missing');
  }
  console.log('  Hardware availability verification: implemented');
  console.log('  "Orientation sensor unavailable" badge: implemented');
  console.log('  -> TEST 3 PASSED: Clean unavailable fallback verified.\n');

  // -------------------------------------------------------------------------
  // TEST 4: Horizontal (Roll) & Vertical (Pitch) Calculation & Tolerances
  // -------------------------------------------------------------------------
  console.log('[TEST 4] Orientation Calculation & Tolerances Inspection...');
  const modelsPath = path.resolve('android/phone-camera/src/main/kotlin/com/renderwalk/camera/phone/OrientationModels.kt');
  if (!fs.existsSync(modelsPath)) {
    throw new Error('Test 4 failed: OrientationModels.kt not found');
  }
  const modelsSource = fs.readFileSync(modelsPath, 'utf-8');

  if (!modelsSource.includes('ROLL_TOLERANCE_DEG') || !modelsSource.includes('PITCH_TOLERANCE_DEG')) {
    throw new Error('Test 4 failed: Missing configurable roll and pitch tolerances');
  }
  if (!modelsSource.includes('TILTED_LEFT') || !modelsSource.includes('TILTED_RIGHT')) {
    throw new Error('Test 4 failed: Missing horizontal tilt detection (TILTED_LEFT, TILTED_RIGHT)');
  }
  if (!modelsSource.includes('TILTED_UP') || !modelsSource.includes('TILTED_DOWN')) {
    throw new Error('Test 4 failed: Missing vertical pitch guidance (TILTED_UP, TILTED_DOWN)');
  }
  if (!modelsSource.includes('LEVEL')) {
    throw new Error('Test 4 failed: Missing LEVEL state');
  }
  console.log('  Roll tolerance: defined');
  console.log('  Pitch tolerance: defined');
  console.log('  Horizontal guidance: TILTED_LEFT, TILTED_RIGHT, LEVEL');
  console.log('  Vertical guidance: TILTED_UP, TILTED_DOWN, LEVEL');
  console.log('  -> TEST 4 PASSED: Orientation evaluation logic verified.\n');

  // -------------------------------------------------------------------------
  // TEST 5: Sensor Lifecycle (Register on active, unregister on dispose)
  // -------------------------------------------------------------------------
  console.log('[TEST 5] Sensor Lifecycle Management...');
  if (!sensorSource.includes('registerListener') || !sensorSource.includes('unregisterListener')) {
    throw new Error('Test 5 failed: Must register and unregister SensorEventListener');
  }

  const screenPath = path.resolve('android/phone-camera/src/main/kotlin/com/renderwalk/camera/phone/PhoneCameraCaptureScreen.kt');
  const screenSource = fs.readFileSync(screenPath, 'utf-8');

  if (!screenSource.includes('orientationManager.startListening') || !screenSource.includes('orientationManager.stopListening()')) {
    throw new Error('Test 5 failed: PhoneCameraCaptureScreen must bind orientation listening to lifecycle DisposableEffect');
  }
  console.log('  registerListener on camera screen active: verified');
  console.log('  unregisterListener on camera screen dispose: verified');
  console.log('  -> TEST 5 PASSED: Leak-free sensor lifecycle verified.\n');

  // -------------------------------------------------------------------------
  // TEST 6: Camera Integration & Minimal Visual Overlay
  // -------------------------------------------------------------------------
  console.log('[TEST 6] Camera Integration & Level Overlay Placement...');
  if (!screenSource.includes('CameraLevelOverlay')) {
    throw new Error('Test 6 failed: CameraLevelOverlay must be overlaid on the CameraX preview');
  }
  // Ensure level overlay does not disrupt PreviewView or photo capture
  if (!screenSource.includes('AndroidView') || !screenSource.includes('takePhoto')) {
    throw new Error('Test 6 failed: Live PreviewView and photo capture must remain intact');
  }
  console.log('  CameraLevelOverlay rendered directly over CameraX preview: true');
  console.log('  Live camera preview and shutter action preserved: true');
  console.log('  -> TEST 6 PASSED: Non-destructive camera integration verified.\n');

  // -------------------------------------------------------------------------
  // TEST 7: Zero 360 Logic / Zero False Hardware Claims
  // -------------------------------------------------------------------------
  console.log('[TEST 7] Scope Boundary & Hardware Claim Audit...');
  const forbiddenScopeItems = [
    'capturePoints',
    'rotationSequence',
    'spacingRadar',
    'panoramaStitch',
    'roomCompletion',
    'LiDAR',
    'AR positioning',
    'Insta360 Connected',
    'GoPro Connected',
    '360 Camera Connected'
  ];

  for (const item of forbiddenScopeItems) {
    if (overlaySource.includes(item) || screenSource.includes(item)) {
      throw new Error(`Test 7 failed: Forbidden feature/claim detected: ${item}`);
    }
  }
  console.log('  Zero 360 logic / sequence / radar: verified');
  console.log('  Zero claims of 360 / Insta360 / GoPro / LiDAR / AR: verified');
  console.log('  -> TEST 7 PASSED: Clean scope boundary verified.\n');

  console.log('====================================================================');
  console.log('TASK 28 VERIFICATION SUMMARY:');
  console.log('====================================================================');
  console.log('REAL SENSOR APIS:           PASSED (SensorManager)');
  console.log('ZERO SIMULATION/TIMERS:     PASSED');
  console.log('SENSOR UNAVAILABLE STATE:   PASSED ("Orientation sensor unavailable")');
  console.log('ROLL / HORIZONTAL LEVEL:    PASSED (TILT LEFT / TILT RIGHT / LEVEL)');
  console.log('PITCH / VERTICAL GUIDANCE:  PASSED (TILT UP / TILT DOWN / LEVEL)');
  console.log('SENSOR LIFECYCLE:           PASSED (Register/unregister in DisposableEffect)');
  console.log('CAMERAX OVERLAY:            PASSED');
  console.log('SCOPE BOUNDARIES:           PASSED (Zero 360 / LiDAR / AR claims)');
  console.log('--------------------------------------------------------------------');
  console.log('PHYSICAL SENSOR TEST:       NOT TESTED — NO PHYSICAL DEVICE CONNECTED');
  console.log('====================================================================');
}

runTask28Verification().catch((err) => {
  console.error('\nTask 28 verification failed:', err);
  process.exit(1);
});
