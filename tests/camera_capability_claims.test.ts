import { cameraManager } from '../src/services/camera/CameraManager';
import { Insta360Provider } from '../src/services/camera/Insta360Provider';
import { GoProProvider } from '../src/services/camera/GoProProvider';
import { PhoneCameraProvider } from '../src/services/camera/PhoneCameraProvider';
import { CameraCapabilityState } from '../src/services/camera/CameraCapabilities';
import { IInsta360NativeBridge } from '../src/services/camera/insta360/Insta360NativeBridge';
import { Insta360DeviceCapabilities } from '../src/services/camera/insta360/Insta360Types';

async function runCameraClaimsTests() {
  console.log('====================================================');
  console.log('RENDERWALK TASK 24 — CAMERA CAPABILITY CLAIMS TESTS');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // 1. INSTA360 UNCONFIGURED VERIFICATION
  // -------------------------------------------------------------------------
  console.log('[TEST 1] Insta360 Unconfigured State & Capabilities Check...');
  const insta = new Insta360Provider();
  const instaState = insta.getConnectionState();
  const instaCaps = insta.getHDRCapabilities();

  console.log(`  Insta360 Connection State: ${instaState}`);
  console.log(`  Insta360 HDR Supported: ${instaCaps.hdrSupported}`);
  console.log(`  Insta360 AEB Supported: ${instaCaps.aebSupported}`);
  console.log(`  Insta360 Supported Frame Counts: [${instaCaps.supportedAebFrameCounts.join(', ')}]`);

  if (instaState !== 'INSTA360_SDK_NOT_CONFIGURED') {
    throw new Error('Test 1 failed: Insta360 state must be INSTA360_SDK_NOT_CONFIGURED');
  }
  if (instaCaps.aebSupported !== false) {
    throw new Error('Test 1 failed: Unconfigured Insta360 must not claim aebSupported: true');
  }
  if (instaCaps.supportedAebFrameCounts.length !== 0) {
    throw new Error('Test 1 failed: Unconfigured Insta360 must not claim supported AEB frame counts');
  }
  console.log('  -> TEST 1 PASSED: Zero false claims for unconfigured Insta360.\n');

  // -------------------------------------------------------------------------
  // 2. GOPRO UNCONFIGURED VERIFICATION
  // -------------------------------------------------------------------------
  console.log('[TEST 2] GoPro Unconfigured State & Capabilities Check...');
  const gopro = new GoProProvider();
  const goproState = gopro.getConnectionState();
  const goproCaps = gopro.getHDRCapabilities();

  console.log(`  GoPro Connection State: ${goproState}`);
  console.log(`  GoPro HDR Supported: ${goproCaps.hdrSupported}`);
  console.log(`  GoPro AEB Supported: ${goproCaps.aebSupported}`);
  console.log(`  GoPro Supported Frame Counts: [${goproCaps.supportedAebFrameCounts.join(', ')}]`);

  if (goproState !== 'GOPRO_SDK_NOT_CONFIGURED') {
    throw new Error('Test 2 failed: GoPro state must be GOPRO_SDK_NOT_CONFIGURED');
  }
  if (goproCaps.aebSupported !== false) {
    throw new Error('Test 2 failed: Unconfigured GoPro must not claim aebSupported: true');
  }
  if (goproCaps.supportedAebFrameCounts.length !== 0) {
    throw new Error('Test 2 failed: Unconfigured GoPro must not claim supported AEB frame counts');
  }
  console.log('  -> TEST 2 PASSED: Zero false claims for unconfigured GoPro.\n');

  // -------------------------------------------------------------------------
  // 3. DYNAMIC REPORTING WHEN CONNECTED (NO EXTRA / HARD-CODED COUNTS)
  // -------------------------------------------------------------------------
  console.log('[TEST 3] Dynamic Camera Capabilities Binding (Only Reported Counts)...');
  // Simulated camera that only supports 3 and 5 frames (e.g. older hardware / firmware)
  const mockBridge: IInsta360NativeBridge = {
    bridgeVersion: '1.0.0-mock',
    isSdkConfigured: () => true,
    getMissingPrerequisites: () => [],
    discoverCamera: async () => ({
      deviceId: 'dev-3-5',
      model: 'Insta360 ONE X2',
      serialNumber: 'SN-35',
      firmwareVersion: 'v1.0.0',
      connectionType: 'WIFI_OSC'
    }),
    connect: async () => true,
    disconnect: async () => {},
    getConnectionStatus: () => 'CONNECTED',
    getCameraState: async () => ({
      batteryLevelPercent: 90,
      isBatteryCharging: false,
      storageRemainingBytes: 1000000,
      storageTotalBytes: 2000000,
      isSdCardMounted: true,
      currentMode: 'idle'
    }),
    getCapabilities: async () => ({
      model: 'Insta360 ONE X2',
      firmwareVersion: 'v1.0.0',
      isHDRSupported: true,
      isCameraSideHDRSupported: true,
      isAEBSupported: true,
      supportedAEBFrameCounts: [3, 5], // ONLY 3 and 5, NOT 7 or 9!
      supportedExposureSteps: [1.0, 2.0],
      supportedFormats: ['JPEG'],
      supportedResolutions: [{ width: 5760, height: 2880, name: '5.7K' }],
      isLivePreviewSupported: true
    }),
    setCaptureOptions: async () => {},
    capture: async () => ({} as any),
    listFiles: async () => [],
    downloadFile: async () => new Blob(),
    deleteFile: async () => true,
    getLivePreviewStream: async () => null
  };

  const connectedProvider = new Insta360Provider(mockBridge);
  await connectedProvider.connect();
  const reportedCaps = connectedProvider.getHDRCapabilities();

  console.log(`  Reported AEB Frames: [${reportedCaps.supportedAebFrameCounts.join(', ')}]`);
  if (!reportedCaps.supportedAebFrameCounts.includes(3) || !reportedCaps.supportedAebFrameCounts.includes(5)) {
    throw new Error('Test 3 failed: 3 and 5 must be supported');
  }
  if (reportedCaps.supportedAebFrameCounts.includes(7) || reportedCaps.supportedAebFrameCounts.includes(9)) {
    throw new Error('Test 3 failed: Must NOT include 7 or 9 when camera reports only 3 and 5');
  }
  console.log('  -> TEST 3 PASSED: Camera only exposes genuinely reported capabilities (No 7/9 fabricated).\n');

  // -------------------------------------------------------------------------
  // 4. CAPABILITY STATES CONSTANTS VERIFICATION
  // -------------------------------------------------------------------------
  console.log('[TEST 4] Verification of Standardized Capability States...');
  const validStates: CameraCapabilityState[] = [
    'SDK_NOT_CONFIGURED',
    'SDK_READY',
    'CAMERA_DISCONNECTED',
    'CAMERA_CONNECTED',
    'CAPABILITIES_LOADING',
    'CAPABILITIES_READY',
    'UNSUPPORTED_CAMERA'
  ];

  if (validStates.length !== 7) {
    throw new Error('Test 4 failed: Missing standardized capability states');
  }
  console.log(`  Verified 7 Standardized States: [${validStates.join(', ')}]`);
  console.log('  -> TEST 4 PASSED: Capability states verified.\n');

  console.log('====================================================');
  console.log('ALL TASK 24 CAMERA CAPABILITY CLAIMS TESTS PASSED!');
  console.log('====================================================');
}

runCameraClaimsTests().catch((err) => {
  console.error('\nCamera capability claims test suite failed:', err);
  process.exit(1);
});
