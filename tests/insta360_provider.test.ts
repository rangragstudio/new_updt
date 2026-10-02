import { Insta360Provider } from '../src/services/camera/Insta360Provider';
import {
  IInsta360NativeBridge,
  Insta360NativeBridge
} from '../src/services/camera/insta360/Insta360NativeBridge';
import {
  Insta360DeviceDescriptor,
  Insta360DeviceCapabilities,
  Insta360CameraState,
  Insta360CaptureOptions,
  Insta360CaptureResult,
  Insta360FileInfo
} from '../src/services/camera/insta360/Insta360Types';
import { CameraError } from '../src/services/camera/CameraProvider';

/**
 * Controlled mock bridge implementation for testing SDK bridge interface contracts
 * without claiming physical camera hardware is connected.
 */
class TestBridgeContract implements IInsta360NativeBridge {
  public readonly bridgeVersion = '1.0.0-test-bridge';
  public configured = true;
  public connected = false;
  public batteryLevel = 85;
  public freeStorage = 10 * 1024 * 1024 * 1024; // 10 GB

  public capabilitiesToReport: Insta360DeviceCapabilities = {
    model: 'Insta360 X4',
    firmwareVersion: 'v1.1.24',
    isHDRSupported: true,
    isCameraSideHDRSupported: true,
    isAEBSupported: true,
    supportedAEBFrameCounts: [3, 5, 7, 9],
    supportedExposureSteps: [0.5, 1.0, 1.5, 2.0],
    supportedFormats: ['JPEG', 'RAW+JPEG'],
    supportedResolutions: [
      { width: 5760, height: 2880, name: '5.7K 360' },
      { width: 8192, height: 4096, name: '8K 360' }
    ],
    isLivePreviewSupported: true
  };

  public isSdkConfigured(): boolean {
    return this.configured;
  }

  public getMissingPrerequisites(): readonly string[] {
    return this.configured ? [] : ['Native daemon not configured'];
  }

  public getConnectionStatus(): 'CONNECTED' | 'DISCONNECTED' | 'SDK_NOT_CONFIGURED' {
    if (!this.configured) return 'SDK_NOT_CONFIGURED';
    return this.connected ? 'CONNECTED' : 'DISCONNECTED';
  }

  public async discoverCamera(): Promise<Insta360DeviceDescriptor | null> {
    if (!this.configured) return null;
    return {
      deviceId: 'insta360-x4-sn12345',
      model: 'Insta360 X4',
      serialNumber: 'IN4-8849204',
      firmwareVersion: 'v1.1.24',
      connectionType: 'WIFI_OSC'
    };
  }

  public async connect(_deviceId: string): Promise<boolean> {
    if (!this.configured) return false;
    this.connected = true;
    return true;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  public async getCameraState(): Promise<Insta360CameraState> {
    return {
      batteryLevelPercent: this.batteryLevel,
      isBatteryCharging: false,
      storageRemainingBytes: this.freeStorage,
      storageTotalBytes: 64 * 1024 * 1024 * 1024,
      isSdCardMounted: true,
      currentMode: 'idle'
    };
  }

  public async getCapabilities(): Promise<Insta360DeviceCapabilities> {
    return this.capabilitiesToReport;
  }

  public async setCaptureOptions(_options: Insta360CaptureOptions): Promise<void> {}

  public async capture(options: Insta360CaptureOptions): Promise<Insta360CaptureResult> {
    if (options.mode === 'hdr') {
      // Single camera-merged HDR image
      const singleFile: Insta360FileInfo = {
        fileId: 'file-hdr-single-1',
        filename: 'IMG_20261002_HDR.jpg',
        fileUrl: 'blob:test-camera/single-hdr.jpg',
        sizeBytes: 15 * 1024 * 1024,
        createdAt: Date.now(),
        mimeType: 'image/jpeg',
        isHDRMerged: true
      };
      return {
        captureGroupId: 'cap-hdr-group-1',
        isHDRMerged: true,
        files: [singleFile],
        cameraModel: 'Insta360 X4',
        timestamp: Date.now()
      };
    }

    // AEB Multi-frame group (e.g. 5 frames)
    const count = options.bracketParams?.count || 3;
    const files: Insta360FileInfo[] = [];
    const step = options.bracketParams?.step || 1.0;

    for (let i = 0; i < count; i++) {
      const ev = (i - Math.floor(count / 2)) * step;
      files.push({
        fileId: `file-aeb-${i}`,
        filename: `IMG_20261002_AEB_${i}.jpg`,
        fileUrl: `blob:test-camera/aeb_${i}.jpg`,
        sizeBytes: 12 * 1024 * 1024,
        createdAt: Date.now(),
        mimeType: 'image/jpeg',
        evOffset: ev,
        frameIndex: i,
        totalFramesInGroup: count
      });
    }

    return {
      captureGroupId: `cap-aeb-group-${count}`,
      isHDRMerged: false,
      files,
      cameraModel: 'Insta360 X4',
      timestamp: Date.now()
    };
  }

  public async listFiles(): Promise<readonly Insta360FileInfo[]> {
    return [];
  }

  public async downloadFile(_fileUrl: string): Promise<Blob> {
    // Generate minimal valid equirectangular 2:1 test image byte stream
    const w = 512;
    const h = 256;
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
    return new Blob([data], { type: 'image/jpeg' });
  }

  public async deleteFile(_fileUrl: string): Promise<boolean> {
    return true;
  }

  public async getLivePreviewStream(): Promise<MediaStream | null> {
    return null;
  }
}

async function runInsta360Tests() {
  console.log('====================================================');
  console.log('RENDERWALK TASK 22 — INSTA360 SDK INTEGRATION TESTS');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // 1. DEFAULT HOST TEST (SDK_NOT_CONFIGURED check on PC environment)
  // -------------------------------------------------------------------------
  console.log('[TEST 1] Default Host Environment Verification (No fake hardware)...');
  const defaultProvider = new Insta360Provider(); // Uses standard Insta360NativeBridge
  const state = defaultProvider.getConnectionState();
  const status = defaultProvider.getStatus();

  console.log(`  Connection State: ${state}`);
  console.log(`  Battery Level: ${await defaultProvider.getBatteryLevel()}`);
  console.log(`  Storage Status: ${await defaultProvider.getStorageStatus()}`);

  if (state !== 'INSTA360_SDK_NOT_CONFIGURED') {
    throw new Error('Test 1 failed: Default state must be INSTA360_SDK_NOT_CONFIGURED');
  }
  if ((await defaultProvider.getBatteryLevel()) !== null) {
    throw new Error('Test 1 failed: Must not return fake battery level');
  }
  if ((await defaultProvider.getStorageStatus()) !== null) {
    throw new Error('Test 1 failed: Must not return fake storage status');
  }

  // Attempting connect when unconfigured must throw structured error
  let connectError: CameraError | null = null;
  try {
    await defaultProvider.connect();
  } catch (err: any) {
    connectError = err;
  }
  if (!connectError || connectError.code !== 'INSTA360_SDK_NOT_CONFIGURED') {
    throw new Error('Test 1 failed: connect() must throw INSTA360_SDK_NOT_CONFIGURED');
  }
  console.log('  -> TEST 1 PASSED: Zero fake hardware verified.\n');

  // -------------------------------------------------------------------------
  // 2. NATIVE BRIDGE CONTRACT & CAPABILITY DISCOVERY
  // -------------------------------------------------------------------------
  console.log('[TEST 2] Native Bridge Connection & Dynamic Capability Discovery...');
  const testBridge = new TestBridgeContract();
  const bridgeProvider = new Insta360Provider(testBridge);

  // Discover and Connect
  const discovered = await bridgeProvider.discover();
  if (!discovered) throw new Error('Test 2 failed: Camera discovery failed');
  const connected = await bridgeProvider.connect();
  if (!connected || bridgeProvider.getConnectionState() !== 'CONNECTED') {
    throw new Error('Test 2 failed: Connection state is not CONNECTED');
  }

  const caps = bridgeProvider.getHDRCapabilities();
  console.log(`  Discovered Model: ${bridgeProvider.getInfo().model}`);
  console.log(`  Supported AEB Frame Counts: [${caps.supportedAebFrameCounts.join(', ')}]`);
  console.log(`  Supported Exposure Steps: [${caps.supportedExposureSteps.join(', ')}]`);
  console.log(`  Camera-Side HDR Supported: ${caps.cameraSideHdrSupported}`);

  if (!caps.supportedAebFrameCounts.includes(5) || !caps.supportedAebFrameCounts.includes(7)) {
    throw new Error('Test 2 failed: Dynamic capabilities not queried properly');
  }
  console.log('  -> TEST 2 PASSED: Dynamic capability discovery verified.\n');

  // -------------------------------------------------------------------------
  // 3. STRICT VALIDATION (NO SILENT DOWNGRADE)
  // -------------------------------------------------------------------------
  console.log('[TEST 3] Strict Validation (Rejecting Unsupported Brackets Without Downgrade)...');
  // Model only supports 3, 5, 7, 9 frames. Requesting 4 frames must throw!
  let unsupportedCountError: CameraError | null = null;
  try {
    await bridgeProvider.captureHDR({
      mode: 'AEB',
      frameCount: 4 as any, // 4 frames is unsupported
      exposureStep: 1.0,
      outputFormat: 'JPEG',
      mergeMode: 'RENDERWALK'
    });
  } catch (err: any) {
    unsupportedCountError = err;
  }

  if (!unsupportedCountError || unsupportedCountError.code !== 'AEB_FRAME_COUNT_NOT_SUPPORTED') {
    throw new Error('Test 3 failed: Must throw AEB_FRAME_COUNT_NOT_SUPPORTED for 4 frames');
  }
  console.log(`  Caught expected structured error: ${unsupportedCountError.code}`);

  // Requesting 3.0 EV step must throw EXPOSURE_STEP_NOT_SUPPORTED
  let unsupportedStepError: CameraError | null = null;
  try {
    await bridgeProvider.captureHDR({
      mode: 'AEB',
      frameCount: 5,
      exposureStep: 3.0 as any,
      outputFormat: 'JPEG',
      mergeMode: 'RENDERWALK'
    });
  } catch (err: any) {
    unsupportedStepError = err;
  }

  if (!unsupportedStepError || unsupportedStepError.code !== 'EXPOSURE_STEP_NOT_SUPPORTED') {
    throw new Error('Test 3 failed: Must throw EXPOSURE_STEP_NOT_SUPPORTED');
  }
  console.log(`  Caught expected structured error: ${unsupportedStepError.code}`);
  console.log('  -> TEST 3 PASSED: Zero silent downgrades.\n');

  // -------------------------------------------------------------------------
  // 4. SINGLE ONBOARD HDR CAPTURE FLOW (Bypasses second HDR merge)
  // -------------------------------------------------------------------------
  console.log('[TEST 4] Single Onboard HDR Capture Flow...');
  const singleHDRResult = await bridgeProvider.captureHDR({
    mode: 'HDR',
    frameCount: 3,
    exposureStep: 1.0,
    outputFormat: 'JPEG',
    mergeMode: 'CAMERA'
  });

  console.log(`  Capture Mode: ${singleHDRResult.mode}, MergeMode: ${singleHDRResult.mergeMode}`);
  console.log(`  Camera-Side HDR Result Blob: ${!!singleHDRResult.cameraSideHdrResult?.blob}`);
  if (singleHDRResult.mergeMode !== 'CAMERA' || !singleHDRResult.cameraSideHdrResult) {
    throw new Error('Test 4 failed: Single HDR must use mergeMode CAMERA');
  }
  console.log('  -> TEST 4 PASSED: Single HDR panorama fast-tracked without second merge.\n');

  // -------------------------------------------------------------------------
  // 5. 5-FRAME AEB BRACKET CAPTURE FLOW
  // -------------------------------------------------------------------------
  console.log('[TEST 5] 5-Frame AEB Multi-frame Capture Flow...');
  const aebResult = await bridgeProvider.captureHDR({
    mode: 'AEB',
    frameCount: 5,
    exposureStep: 1.0,
    outputFormat: 'JPEG',
    mergeMode: 'RENDERWALK'
  });

  console.log(`  Capture Mode: ${aebResult.mode}, MergeMode: ${aebResult.mergeMode}`);
  console.log(`  Bracket Frames Captured: ${aebResult.bracketFrames.length}`);
  if (aebResult.bracketFrames.length !== 5 || aebResult.mergeMode !== 'RENDERWALK') {
    throw new Error('Test 5 failed: AEB capture must retain 5 frames for RenderWalk merge');
  }
  console.log('  -> TEST 5 PASSED: 5-frame AEB capture enqueued into processing pipeline.\n');

  // -------------------------------------------------------------------------
  // 6. LOW BATTERY & STORAGE FULL PROTECTIONS
  // -------------------------------------------------------------------------
  console.log('[TEST 6] Safety Protections (Low Battery & Full Storage)...');
  testBridge.batteryLevel = 5; // Low battery < 10%
  let lowBatteryError: CameraError | null = null;
  try {
    await bridgeProvider.captureHDR({
      mode: 'AEB',
      frameCount: 3,
      exposureStep: 1.0,
      outputFormat: 'JPEG',
      mergeMode: 'RENDERWALK'
    });
  } catch (err: any) {
    lowBatteryError = err;
  }
  if (!lowBatteryError || lowBatteryError.code !== 'LOW_BATTERY') {
    throw new Error('Test 6 failed: Must throw LOW_BATTERY when battery < 10%');
  }
  console.log(`  Caught expected safety error: ${lowBatteryError.code}`);

  // Restore battery, test full storage (< 50MB)
  testBridge.batteryLevel = 90;
  testBridge.freeStorage = 10 * 1024 * 1024; // 10MB
  let storageFullError: CameraError | null = null;
  try {
    await bridgeProvider.captureHDR({
      mode: 'AEB',
      frameCount: 3,
      exposureStep: 1.0,
      outputFormat: 'JPEG',
      mergeMode: 'RENDERWALK'
    });
  } catch (err: any) {
    storageFullError = err;
  }
  if (!storageFullError || storageFullError.code !== 'STORAGE_FULL') {
    throw new Error('Test 6 failed: Must throw STORAGE_FULL');
  }
  console.log(`  Caught expected safety error: ${storageFullError.code}`);
  console.log('  -> TEST 6 PASSED: Hardware safety constraints verified.\n');

  console.log('====================================================');
  console.log('ALL TASK 22 INSTA360 INTEGRATION TESTS PASSED!');
  console.log('====================================================');
}

runInsta360Tests().catch((err) => {
  console.error('\nInsta360 test suite failed:', err);
  process.exit(1);
});
