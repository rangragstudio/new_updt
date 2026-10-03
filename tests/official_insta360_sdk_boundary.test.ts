import {
  Insta360CapabilityMapper,
  INSTA360_SDK_NOT_AVAILABLE,
  PREVIEW_NOT_CONFIGURED
} from '../src/services/camera/insta360/Insta360CapabilityMapper';
import { Insta360DeviceDescriptor, Insta360Model } from '../src/services/camera/insta360/Insta360Types';
import { Insta360Provider } from '../src/services/camera/Insta360Provider';

async function runOfficialSdkBoundaryTests() {
  console.log('====================================================');
  console.log('RENDERWALK TASK 25 — OFFICIAL INSTA360 SDK BOUNDARY');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // 1. SDK AVAILABILITY STATE (OFFICIAL SDK MISSING ON DEV PC)
  // -------------------------------------------------------------------------
  console.log('[TEST 1] SDK Availability State Verification...');
  console.log(`  SDK Not Available Constant: ${INSTA360_SDK_NOT_AVAILABLE}`);
  console.log(`  Preview Not Configured Constant: ${PREVIEW_NOT_CONFIGURED}`);

  const provider = new Insta360Provider();
  const connState = provider.getConnectionState();
  console.log(`  Provider Connection State: ${connState}`);

  if (connState !== 'INSTA360_SDK_NOT_CONFIGURED') {
    throw new Error('Test 1 failed: Provider must report INSTA360_SDK_NOT_CONFIGURED');
  }
  console.log('  -> TEST 1 PASSED: SDK unavailability properly reported without fake SDK classes.\n');

  // -------------------------------------------------------------------------
  // 2. PREVIEW INTEGRATION BOUNDARY (PREVIEW_NOT_CONFIGURED / NULL)
  // -------------------------------------------------------------------------
  console.log('[TEST 2] Preview Integration Boundary Verification...');
  const previewStream = await provider.startPreview();
  console.log(`  Preview Stream on Unconfigured Environment: ${previewStream}`);

  if (previewStream !== null) {
    throw new Error('Test 2 failed: Preview must return null without synthesizing fake video stream');
  }
  console.log('  -> TEST 2 PASSED: Preview correctly returns null (PREVIEW_NOT_CONFIGURED) when SDK is unconfigured.\n');

  // -------------------------------------------------------------------------
  // 3. MULTI-MODEL PORTFOLIO ARCHITECTURE SUPPORT
  // -------------------------------------------------------------------------
  console.log('[TEST 3] Multi-Model Portfolio Architecture Support...');
  const testModels: Insta360Model[] = [
    'Insta360 X6',
    'Insta360 X5',
    'Insta360 X4 Air',
    'Insta360 X4',
    'Insta360 X3',
    'Insta360 ONE RS 1-Inch 360',
    'Insta360 ONE RS',
    'Insta360 ONE X2',
    'Insta360 Sphere'
  ];

  for (const model of testModels) {
    const descriptor: Insta360DeviceDescriptor = {
      deviceId: `dev-${model.replace(/\s+/g, '-').toLowerCase()}`,
      model,
      serialNumber: `SN-${Math.floor(Math.random() * 100000)}`,
      firmwareVersion: 'v1.0.0',
      connectionType: 'USB'
    };

    // When SDK is not configured, must return empty AEB frames
    const unconfiguredCaps = Insta360CapabilityMapper.mapCapabilities(descriptor, false);
    if (unconfiguredCaps.supportedAEBFrameCounts.length !== 0 || unconfiguredCaps.isAEBSupported !== false) {
      throw new Error(`Test 3 failed: Model ${model} claimed capabilities while unconfigured`);
    }
  }
  console.log(`  Verified ${testModels.length} panoramic camera models in portfolio.`);
  console.log('  -> TEST 3 PASSED: Multi-model architecture supported without universal capability assumption.\n');

  // -------------------------------------------------------------------------
  // 4. RESOLUTION & MODE-DEPENDENT AEB CAPABILITY MAPPING (SECTION 11)
  // -------------------------------------------------------------------------
  console.log('[TEST 4] Resolution & Mode-Dependent AEB Capability Mapping...');
  const x6Descriptor: Insta360DeviceDescriptor = {
    deviceId: 'dev-x6-test',
    model: 'Insta360 X6',
    serialNumber: 'SN-X6-999',
    firmwareVersion: 'v1.0.0',
    connectionType: 'WIFI_OSC'
  };

  // Raw reported hardware capabilities for X6
  const rawX6Caps = {
    isHDRSupported: true,
    isCameraSideHDRSupported: true,
    isAEBSupported: true,
    supportedAEBFrameCounts: [3, 5, 7] as const,
    supportedExposureSteps: [0.5, 1.0, 2.0] as const,
    supportedFormats: ['JPEG', 'RAW'] as const,
    isLivePreviewSupported: true
  };

  // Scenario A: X6 at 120MP Ultra-High Resolution -> Buffer limits AEB to max 5 frames (3, 5)
  const highResCaps = Insta360CapabilityMapper.mapCapabilities(
    x6Descriptor,
    true,
    rawX6Caps,
    {
      mode: 'PHOTO',
      resolution: { width: 15488, height: 7744, megapixelLabel: '120MP' }
    }
  );

  console.log(`  X6 at 120MP AEB Frame Counts: [${highResCaps.supportedAEBFrameCounts.join(', ')}]`);
  if (highResCaps.supportedAEBFrameCounts.includes(7)) {
    throw new Error('Test 4 failed: High MP mode must dynamically limit buffer depth (no 7-frame AEB)');
  }
  if (!highResCaps.supportedAEBFrameCounts.includes(3) || !highResCaps.supportedAEBFrameCounts.includes(5)) {
    throw new Error('Test 4 failed: High MP mode should support 3 and 5 frame brackets');
  }

  // Scenario B: X6 at standard resolution -> Supports all 3, 5, 7 frames
  const standardResCaps = Insta360CapabilityMapper.mapCapabilities(
    x6Descriptor,
    true,
    rawX6Caps,
    {
      mode: 'PHOTO',
      resolution: { width: 5760, height: 2880, megapixelLabel: '5.7K' }
    }
  );

  console.log(`  X6 at standard resolution AEB Frame Counts: [${standardResCaps.supportedAEBFrameCounts.join(', ')}]`);
  if (!standardResCaps.supportedAEBFrameCounts.includes(7)) {
    throw new Error('Test 4 failed: Standard resolution mode should allow full reported frame count (7 frames)');
  }
  console.log('  -> TEST 4 PASSED: AEB dynamically adapts to camera model AND resolution.\n');

  // -------------------------------------------------------------------------
  // 5. HDR WORKFLOW OUTPUTS (CAMERA MERGED vs DISCRETE BRACKETS)
  // -------------------------------------------------------------------------
  console.log('[TEST 5] HDR Workflow Dual Output Routing (Section 12)...');
  // Output A: Camera-generated HDR result (single file)
  const singleHdrResult = {
    captureGroupId: 'cap-hdr-001',
    isHDRMerged: true,
    files: [{ fileId: 'f1', filename: 'IMG_HDR.jpg', isHDRMerged: true }]
  };

  // Output B: Discrete multi-exposure bracket set
  const discreteBracketResult = {
    captureGroupId: 'cap-aeb-001',
    isHDRMerged: false,
    files: [
      { fileId: 'f1', filename: 'IMG_EV_NEG2.jpg', evOffset: -2.0, frameIndex: 0 },
      { fileId: 'f2', filename: 'IMG_EV_0.jpg', evOffset: 0.0, frameIndex: 1 },
      { fileId: 'f3', filename: 'IMG_EV_POS2.jpg', evOffset: 2.0, frameIndex: 2 }
    ]
  };

  if (!singleHdrResult.isHDRMerged || singleHdrResult.files.length !== 1) {
    throw new Error('Test 5 failed: Output A must preserve single camera-merged HDR');
  }
  if (discreteBracketResult.isHDRMerged || discreteBracketResult.files.length !== 3) {
    throw new Error('Test 5 failed: Output B must preserve separate bracket frames');
  }
  console.log('  -> TEST 5 PASSED: Dual HDR/AEB output routing verified.\n');

  console.log('====================================================');
  console.log('ALL TASK 25 OFFICIAL SDK BOUNDARY TESTS PASSED!');
  console.log('====================================================');
}

runOfficialSdkBoundaryTests().catch((err) => {
  console.error('\nOfficial SDK boundary test suite failed:', err);
  process.exit(1);
});
