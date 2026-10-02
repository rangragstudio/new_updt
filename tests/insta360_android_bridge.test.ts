import {
  Insta360AndroidBridge,
  AndroidCameraEvent,
  AndroidCameraEventType
} from '../src/services/camera/insta360/Insta360AndroidBridge';
import { Insta360Provider } from '../src/services/camera/Insta360Provider';

/**
 * Mock implementation of the Android JavascriptInterface (window.RenderWalkInsta360Bridge)
 * to test the bi-directional bridge contract without requiring physical Android hardware.
 */
class MockAndroidJavascriptInterface {
  public configured = true;
  public connected = false;
  public state = 'DISCONNECTED';

  public isSdkConfigured(): boolean {
    return this.configured;
  }

  public discover(): string {
    return JSON.stringify([
      {
        deviceId: 'insta360-android-device-1',
        model: 'Insta360 X4',
        serialNumber: 'IN4-AND-99120',
        firmwareVersion: 'v1.2.0',
        connectionType: 'USB_OTG'
      }
    ]);
  }

  public connect(_deviceId: string): boolean {
    this.connected = true;
    this.state = 'CONNECTED';
    return true;
  }

  public disconnect(): void {
    this.connected = false;
    this.state = 'DISCONNECTED';
  }

  public getStatus(): string {
    return JSON.stringify({
      state: this.state,
      batteryPercent: 88,
      isCharging: false,
      storageFreeBytes: 32000000000,
      storageTotalBytes: 64000000000,
      firmwareVersion: 'v1.2.0',
      errorMessage: null
    });
  }

  public getCapabilities(): string {
    return JSON.stringify({
      model: 'Insta360 X4',
      hdrSupported: true,
      aebSupported: true,
      supportedAebFrameCounts: [3, 5, 7, 9],
      supportedExposureSteps: [0.5, 1.0, 1.5, 2.0],
      rawSupported: true,
      jpegSupported: true,
      cameraSideHdrSupported: true,
      previewSupported: true
    });
  }

  public startPreview(): string {
    return JSON.stringify({ streamUrl: 'rtsp://127.0.0.1:8554/live' });
  }

  public stopPreview(): void {}

  public capture(): string {
    return JSON.stringify({
      captureGroupId: 'cap-android-normal-1',
      timestamp: Date.now(),
      mode: 'NORMAL',
      isCameraSideMerged: false,
      files: [
        {
          fileId: 'file-and-1',
          filename: 'IMG_AND_001.jpg',
          localFilePath: '/data/user/0/com.renderwalk/cache/IMG_AND_001.jpg',
          sizeBytes: 8500000,
          evOffset: 0,
          frameIndex: 0
        }
      ]
    });
  }

  public captureHDR(paramsJson: string): string {
    const params = JSON.parse(paramsJson);
    if (params.mode === 'HDR') {
      return JSON.stringify({
        captureGroupId: 'cap-android-hdr-single',
        timestamp: Date.now(),
        mode: 'HDR',
        isCameraSideMerged: true,
        files: [
          {
            fileId: 'file-and-hdr-single',
            filename: 'IMG_AND_HDR.jpg',
            localFilePath: '/data/user/0/com.renderwalk/cache/IMG_AND_HDR.jpg',
            sizeBytes: 14000000,
            evOffset: 0,
            frameIndex: 0
          }
        ]
      });
    }

    // AEB bracket files (e.g. 5 frames)
    const count = params.frameCount || 3;
    const step = params.exposureStep || 1.0;
    const files = [];
    for (let i = 0; i < count; i++) {
      const ev = (i - Math.floor(count / 2)) * step;
      files.push({
        fileId: `file-and-aeb-${i}`,
        filename: `IMG_AND_AEB_${i}.jpg`,
        localFilePath: `/data/user/0/com.renderwalk/cache/IMG_AND_AEB_${i}.jpg`,
        sizeBytes: 9000000,
        evOffset: ev,
        frameIndex: i
      });
    }

    return JSON.stringify({
      captureGroupId: `cap-android-aeb-${count}`,
      timestamp: Date.now(),
      mode: 'AEB',
      isCameraSideMerged: false,
      files
    });
  }

  public listMedia(): string {
    return JSON.stringify([
      {
        id: 'media-and-1',
        name: 'IMG_0001.insp',
        sizeBytes: 15000000,
        createdAt: Date.now(),
        mimeType: 'image/insp'
      }
    ]);
  }

  public downloadMedia(mediaId: string, destinationPath: string): string {
    return JSON.stringify({
      mediaId,
      destinationPath,
      bytesDownloaded: 15000000
    });
  }

  public deleteMedia(_mediaId: string): boolean {
    return true;
  }

  public getBattery(): string {
    return JSON.stringify({ levelPercent: 88, isCharging: false });
  }

  public getStorage(): string {
    return JSON.stringify({ freeBytes: 32000000000, totalBytes: 64000000000 });
  }

  public getIMU(): string {
    return JSON.stringify({ roll: 0.1, pitch: -0.2, yaw: 45.0 });
  }
}

async function runAndroidBridgeTests() {
  console.log('====================================================');
  console.log('RENDERWALK TASK 23 — ANDROID CAMERA BRIDGE TESTS');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // 1. DEFAULT UNCONFIGURED ENVIRONMENT (PC / Web Host check)
  // -------------------------------------------------------------------------
  console.log('[TEST 1] Default Environment Detection (Unconfigured Host)...');
  const defaultAndroidBridge = new Insta360AndroidBridge();
  const isConfigured = defaultAndroidBridge.isSdkConfigured();
  const missing = defaultAndroidBridge.getMissingPrerequisites();

  console.log(`  SDK Configured: ${isConfigured}`);
  console.log(`  Missing Prerequisites Count: ${missing.length}`);
  console.log(`  Connection Status: ${defaultAndroidBridge.getConnectionStatus()}`);

  if (isConfigured !== false || defaultAndroidBridge.getConnectionStatus() !== 'SDK_NOT_CONFIGURED') {
    throw new Error('Test 1 failed: Default bridge must be SDK_NOT_CONFIGURED');
  }
  console.log('  -> TEST 1 PASSED: Correctly identified unconfigured PC environment.\n');

  // -------------------------------------------------------------------------
  // 2. CONNECTED ANDROID BRIDGE & DISCOVERY
  // -------------------------------------------------------------------------
  console.log('[TEST 2] Android Native Bridge Discovery & Connection...');
  const mockInterface = new MockAndroidJavascriptInterface();
  const bridge = new Insta360AndroidBridge(mockInterface);

  const discoveredDevice = await bridge.discoverCamera();
  console.log(`  Discovered Device Model: ${discoveredDevice?.model}`);
  console.log(`  Connection Type: ${discoveredDevice?.connectionType}`);

  if (discoveredDevice?.model !== 'Insta360 X4') {
    throw new Error('Test 2 failed: Discovery did not return Insta360 X4');
  }

  const connected = await bridge.connect(discoveredDevice.deviceId);
  if (!connected || bridge.getConnectionStatus() !== 'CONNECTED') {
    throw new Error('Test 2 failed: Bridge connection failed');
  }
  console.log('  -> TEST 2 PASSED: Android bridge connected successfully.\n');

  // -------------------------------------------------------------------------
  // 3. CAPABILITY DISCOVERY ACROSS ANDROID BRIDGE
  // -------------------------------------------------------------------------
  console.log('[TEST 3] Dynamic Capability Discovery Across Android Bridge...');
  const caps = await bridge.getCapabilities();
  console.log(`  Camera Model: ${caps.model}`);
  console.log(`  Supported AEB Frame Counts: [${caps.supportedAEBFrameCounts.join(', ')}]`);
  console.log(`  Supported Exposure Steps: [${caps.supportedExposureSteps.join(', ')}]`);
  console.log(`  RAW Supported: ${caps.supportedFormats.includes('RAW')}`);

  if (!caps.supportedAEBFrameCounts.includes(5) || !caps.supportedAEBFrameCounts.includes(7)) {
    throw new Error('Test 3 failed: Capabilities missing AEB frame counts');
  }
  console.log('  -> TEST 3 PASSED: Dynamic capabilities queried successfully.\n');

  // -------------------------------------------------------------------------
  // 4. CAMERA EVENTS DISPATCHING
  // -------------------------------------------------------------------------
  console.log('[TEST 4] Camera Events Dispatching Across Bridge...');
  const receivedEvents: AndroidCameraEvent[] = [];
  const unsubscribe = bridge.addCameraEventListener((evt) => {
    receivedEvents.push(evt);
  });

  // Trigger event dispatch via global Android window callback
  const testEventTypes: AndroidCameraEventType[] = [
    'CAMERA_CONNECTED',
    'CAPTURE_STARTED',
    'CAPTURE_PROGRESS',
    'CAPTURE_COMPLETED',
    'MEDIA_AVAILABLE',
    'CAMERA_DISCONNECTED'
  ];

  const globalScope = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
  for (const type of testEventTypes) {
    if (globalScope.__RENDERWALK_DISPATCH_CAMERA_EVENT__) {
      globalScope.__RENDERWALK_DISPATCH_CAMERA_EVENT__(type, { test: true });
    }
  }

  console.log(`  Events Received: ${receivedEvents.length}`);
  if (receivedEvents.length !== testEventTypes.length) {
    throw new Error('Test 4 failed: Not all events received');
  }
  unsubscribe();
  console.log('  -> TEST 4 PASSED: Camera events dispatched and received.\n');

  // -------------------------------------------------------------------------
  // 5. SINGLE HDR CAPTURE ACROSS ANDROID BRIDGE
  // -------------------------------------------------------------------------
  console.log('[TEST 5] Single HDR Panorama Capture Across Android Bridge...');
  const singleHdrResult = await bridge.capture({
    mode: 'hdr'
  });

  console.log(`  Is HDR Merged: ${singleHdrResult.isHDRMerged}`);
  console.log(`  Files Count: ${singleHdrResult.files.length}`);
  console.log(`  Capture Group ID: ${singleHdrResult.captureGroupId}`);

  if (!singleHdrResult.isHDRMerged || singleHdrResult.files.length !== 1) {
    throw new Error('Test 5 failed: Single HDR must report isHDRMerged: true with 1 file');
  }
  console.log('  -> TEST 5 PASSED: Single HDR panorama fast-track verified.\n');

  // -------------------------------------------------------------------------
  // 6. 5-FRAME AEB BRACKET CAPTURE ACROSS ANDROID BRIDGE
  // -------------------------------------------------------------------------
  console.log('[TEST 6] 5-Frame AEB Multi-Exposure Bracket Capture...');
  const aebResult = await bridge.capture({
    mode: 'bracket',
    bracketParams: {
      count: 5,
      step: 1.0,
      format: 'JPEG'
    }
  });

  console.log(`  Is HDR Merged: ${aebResult.isHDRMerged}`);
  console.log(`  Bracket Files Count: ${aebResult.files.length}`);
  console.log(`  Capture Group ID: ${aebResult.captureGroupId}`);

  if (aebResult.isHDRMerged || aebResult.files.length !== 5) {
    throw new Error('Test 6 failed: AEB bracket must return 5 individual files without onboard merge');
  }
  console.log('  -> TEST 6 PASSED: 5-frame AEB multi-frame set captured.\n');

  // -------------------------------------------------------------------------
  // 7. INTEGRATION WITH INSTA360PROVIDER
  // -------------------------------------------------------------------------
  console.log('[TEST 7] Insta360Provider Integration with Android Bridge...');
  const provider = new Insta360Provider(bridge);
  await provider.connect();

  const providerCaps = provider.getHDRCapabilities();
  console.log(`  Provider HDR Supported: ${providerCaps.hdrSupported}`);
  console.log(`  Provider AEB Frame Counts: [${providerCaps.supportedAebFrameCounts.join(', ')}]`);

  // Run AEB capture through provider
  const providerResult = await provider.captureHDR({
    mode: 'AEB',
    frameCount: 5,
    exposureStep: 1.0,
    outputFormat: 'JPEG',
    mergeMode: 'RENDERWALK'
  });

  console.log(`  Provider Capture Status: ${providerResult.status}`);
  console.log(`  Provider Bracket Frames: ${providerResult.bracketFrames.length}`);
  if (providerResult.bracketFrames.length !== 5 || providerResult.status !== 'COMPLETED') {
    throw new Error('Test 7 failed: Provider AEB capture failed');
  }
  console.log('  -> TEST 7 PASSED: Insta360Provider fully integrated with Android bridge.\n');

  console.log('====================================================');
  console.log('ALL TASK 23 ANDROID BRIDGE TESTS PASSED!');
  console.log('====================================================');
}

runAndroidBridgeTests().catch((err) => {
  console.error('\nAndroid bridge test suite failed:', err);
  process.exit(1);
});
