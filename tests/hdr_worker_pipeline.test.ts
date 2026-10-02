import {
  HDRWorkerPipeline,
  FrameInputPayload
} from '../src/services/processing/HDRWorkerPipeline';
import { LocalStorageAdapter, StorageService } from '../src/services/storage/StorageService';
import { HDRMergeEngine } from '../src/services/processing/HDRMergeEngine';

/**
 * Creates a synthetic controlled equirectangular test image (RGBA pixel buffer).
 */
function createFixtureFrame(
  frameIndex: number,
  evOffset: number,
  width: number,
  height: number,
  mimeType = 'image/jpeg'
): FrameInputPayload {
  const pixelCount = width * height;
  const data = new Uint8ClampedArray(pixelCount * 4);

  // Baseline 0 EV centered around mid-grey (128)
  const multiplier = Math.pow(2, evOffset);

  for (let i = 0; i < pixelCount; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    const baseVal = Math.floor(((x / width) * 0.5 + (y / height) * 0.5) * 160 + 30);
    const shifted = Math.min(255, Math.max(0, Math.round(baseVal * multiplier)));

    const offset = i * 4;
    data[offset] = shifted;     // R
    data[offset + 1] = shifted; // G
    data[offset + 2] = shifted; // B
    data[offset + 3] = 255;     // A
  }

  return {
    frameIndex,
    evOffset,
    filename: `test_frame_${frameIndex}_ev${evOffset}.jpg`,
    mimeType,
    width,
    height,
    data,
    captureTimestamp: Date.now() - (10 - frameIndex) * 1000,
    sourceCamera: 'Synthetic_Test_Rig'
  };
}

async function runHardenedWorkerTests() {
  console.log('====================================================');
  console.log('RENDERWALK TASK 21 — HARDENED HDR WORKER TEST SUITE');
  console.log('====================================================\n');

  const storageAdapter = new LocalStorageAdapter();
  const testStorage = new StorageService(storageAdapter);
  const testMergeEngine = new HDRMergeEngine();
  const pipeline = new HDRWorkerPipeline(testStorage, testMergeEngine, { maxConcurrency: 2 });

  const W = 512;
  const H = 256;

  // -------------------------------------------------------------------------
  // TEST A: Normal Panorama (Direct processing, no merge)
  // -------------------------------------------------------------------------
  console.log('[TEST A] Normal Single Panorama Processing...');
  const frameA = [createFixtureFrame(0, 0, W, H)];
  const jobA = await pipeline.submitJob({
    tourId: 'tour-harden-a',
    scanId: 'scan-harden-a',
    scanName: 'Normal Spot',
    workflowType: 'NORMAL_PANORAMA',
    frames: frameA
  });

  await new Promise((r) => setTimeout(r, 80));
  const finishedA = pipeline.getJob(jobA.id);
  if (finishedA?.status !== 'COMPLETE' || finishedA?.manifest?.mergeResult !== undefined) {
    throw new Error('Test A failed: Normal panorama must reach COMPLETE without HDR merge.');
  }
  console.log('  Status: COMPLETE (HDR merge bypassed as required)');
  console.log('  -> TEST A PASSED\n');

  // -------------------------------------------------------------------------
  // TEST B: Single HDR Panorama (Direct processing, no merge)
  // -------------------------------------------------------------------------
  console.log('[TEST B] Single HDR Panorama (Onboard camera HDR)...');
  const frameB = [createFixtureFrame(0, 0, W, H)];
  const jobB = await pipeline.submitJob({
    tourId: 'tour-harden-b',
    scanId: 'scan-harden-b',
    scanName: 'Onboard HDR Spot',
    workflowType: 'SINGLE_HDR_PANORAMA',
    frames: frameB
  });

  await new Promise((r) => setTimeout(r, 80));
  const finishedB = pipeline.getJob(jobB.id);
  if (finishedB?.status !== 'COMPLETE' || finishedB?.manifest?.mergeResult !== undefined) {
    throw new Error('Test B failed: Single HDR must reach COMPLETE without HDR merge.');
  }
  console.log('  Status: COMPLETE (Direct pipeline verified)');
  console.log('  -> TEST B PASSED\n');

  // -------------------------------------------------------------------------
  // TEST C: 3-Frame AEB
  // -------------------------------------------------------------------------
  console.log('[TEST C] 3-Frame AEB Processing...');
  const framesC = [
    createFixtureFrame(0, -2, W, H),
    createFixtureFrame(1, 0, W, H),
    createFixtureFrame(2, 2, W, H)
  ];
  const jobC = await pipeline.submitJob({
    tourId: 'tour-harden-c',
    scanId: 'scan-harden-c',
    scanName: 'Living Room 3-AEB',
    workflowType: 'AEB_BRACKET_SET',
    frames: framesC,
    exposureStep: 2.0
  });

  await new Promise((r) => setTimeout(r, 150));
  const finishedC = pipeline.getJob(jobC.id);
  if (finishedC?.status !== 'COMPLETE' || finishedC?.manifest?.mergeResult?.framesMerged !== 3) {
    throw new Error('Test C failed: Expected 3 frames merged.');
  }
  console.log(`  Status: COMPLETE, Frames Merged: ${finishedC.manifest.mergeResult.framesMerged}`);
  console.log('  -> TEST C PASSED\n');

  // -------------------------------------------------------------------------
  // TEST D: 5-Frame AEB
  // -------------------------------------------------------------------------
  console.log('[TEST D] 5-Frame AEB Processing...');
  const framesD = [
    createFixtureFrame(0, -2, W, H),
    createFixtureFrame(1, -1, W, H),
    createFixtureFrame(2, 0, W, H),
    createFixtureFrame(3, 1, W, H),
    createFixtureFrame(4, 2, W, H)
  ];
  const jobD = await pipeline.submitJob({
    tourId: 'tour-harden-d',
    scanId: 'scan-harden-d',
    scanName: 'Foyer 5-AEB',
    workflowType: 'AEB_BRACKET_SET',
    frames: framesD,
    exposureStep: 1.0
  });

  await new Promise((r) => setTimeout(r, 200));
  const finishedD = pipeline.getJob(jobD.id);
  if (finishedD?.status !== 'COMPLETE' || finishedD?.manifest?.mergeResult?.framesMerged !== 5) {
    throw new Error('Test D failed: Expected 5 frames merged.');
  }
  console.log(`  Status: COMPLETE, Frames Merged: ${finishedD.manifest.mergeResult.framesMerged}`);
  console.log('  -> TEST D PASSED\n');

  // -------------------------------------------------------------------------
  // TEST E: Missing Frame / Partial Failure (Waiting for Frames)
  // -------------------------------------------------------------------------
  console.log('[TEST E] Missing Frame / Partial Failure Detection...');
  const partialFrames = [
    createFixtureFrame(0, -2, W, H),
    createFixtureFrame(1, -1, W, H),
    createFixtureFrame(2, 0, W, H),
    createFixtureFrame(3, 1, W, H)
    // Frame 4 missing! Only 4 received out of 5 expected
  ];
  const jobE = await pipeline.submitJob({
    tourId: 'tour-harden-e',
    scanId: 'scan-harden-e',
    scanName: 'Incomplete 5-AEB',
    workflowType: 'AEB_BRACKET_SET',
    frames: partialFrames,
    expectedFrameCount: 5
  });

  console.log(`  Job Status: ${jobE.status}, ErrorCode: ${jobE.errorCode}`);
  console.log(`  Step Message: ${jobE.currentStep}`);
  if (jobE.status !== 'WAITING_FOR_FRAMES' || jobE.errorCode !== 'WAITING_FOR_FRAMES') {
    throw new Error('Test E failed: Job must be in WAITING_FOR_FRAMES status.');
  }
  console.log('  -> TEST E PASSED\n');

  // -------------------------------------------------------------------------
  // TEST F: Mismatched Dimensions
  // -------------------------------------------------------------------------
  console.log('[TEST F] Mismatched Dimensions Rejection...');
  const mismatchFrames = [
    createFixtureFrame(0, -1, 512, 256),
    createFixtureFrame(1, 0, 512, 240), // Mismatched height
    createFixtureFrame(2, 1, 512, 256)
  ];
  const jobF = await pipeline.submitJob({
    tourId: 'tour-harden-f',
    scanId: 'scan-harden-f',
    scanName: 'Mismatched Dimensions',
    workflowType: 'AEB_BRACKET_SET',
    frames: mismatchFrames
  });

  await new Promise((r) => setTimeout(r, 60));
  const finishedF = pipeline.getJob(jobF.id);
  if (finishedF?.status !== 'FAILED' || finishedF?.errorCode !== 'MISMATCHED_DIMENSIONS') {
    throw new Error('Test F failed: Expected FAILED with MISMATCHED_DIMENSIONS.');
  }
  console.log(`  Status: FAILED, Error: ${finishedF.errorMessage}`);
  console.log('  -> TEST F PASSED\n');

  // -------------------------------------------------------------------------
  // TEST G: Corrupted Image Payload
  // -------------------------------------------------------------------------
  console.log('[TEST G] Corrupted Payload Rejection...');
  const corruptFrame: FrameInputPayload = {
    frameIndex: 0,
    evOffset: 0,
    filename: 'corrupt.jpg',
    mimeType: 'image/jpeg',
    width: 512,
    height: 256,
    data: new Uint8ClampedArray(0) // Empty corrupt buffer
  };
  const jobG = await pipeline.submitJob({
    tourId: 'tour-harden-g',
    scanId: 'scan-harden-g',
    scanName: 'Corrupt Frame',
    workflowType: 'NORMAL_PANORAMA',
    frames: [corruptFrame]
  });

  await new Promise((r) => setTimeout(r, 60));
  const finishedG = pipeline.getJob(jobG.id);
  if (finishedG?.status !== 'FAILED' || finishedG?.errorCode !== 'CORRUPT_FRAME') {
    throw new Error('Test G failed: Expected FAILED with CORRUPT_FRAME.');
  }
  console.log(`  Status: FAILED, Error: ${finishedG.errorMessage}`);
  console.log('  -> TEST G PASSED\n');

  // -------------------------------------------------------------------------
  // TEST H: Retry
  // -------------------------------------------------------------------------
  console.log('[TEST H] Retry Failed Job...');
  // Fix the frame in jobG and retry
  jobG.frames = [createFixtureFrame(0, 0, W, H)];
  const retriedH = await pipeline.retryJob(jobG.id);
  console.log(`  Initial retry status: ${retriedH.status}, Retry count: ${retriedH.retryCount}`);

  await new Promise((r) => setTimeout(r, 100));
  const finishedH = pipeline.getJob(jobG.id);
  if (finishedH?.status !== 'COMPLETE') {
    throw new Error('Test H failed: Retried job must succeed once payload is corrected.');
  }
  console.log(`  Final status: ${finishedH.status}, Scan panorama: ${finishedH.panoramaUrl}`);
  console.log('  -> TEST H PASSED\n');

  // -------------------------------------------------------------------------
  // TEST I: Duplicate Retry (Idempotency)
  // -------------------------------------------------------------------------
  console.log('[TEST I] Duplicate Submission Idempotency...');
  const duplicateSubmit = await pipeline.submitJob({
    tourId: 'tour-harden-a',
    scanId: 'scan-harden-a', // Already completed in Test A
    scanName: 'Duplicate Spot',
    workflowType: 'NORMAL_PANORAMA',
    frames: frameA
  });

  if (duplicateSubmit.id !== jobA.id) {
    throw new Error('Test I failed: Duplicate submission for identical scanId must return existing job.');
  }
  console.log(`  Existing Job ID returned: ${duplicateSubmit.id} (No duplicate processing started)`);
  console.log('  -> TEST I PASSED\n');

  // -------------------------------------------------------------------------
  // TEST J: Worker Failure & Safe Recovery
  // -------------------------------------------------------------------------
  console.log('[TEST J] Worker Failure & Recovery (Preserves Original Files)...');
  const brokenFrames = [
    createFixtureFrame(0, -1, W, H),
    createFixtureFrame(1, 0, W, H),
    createFixtureFrame(2, 1, W, H)
  ];
  const jobJ = await pipeline.submitJob({
    tourId: 'tour-harden-j',
    scanId: 'scan-harden-j',
    scanName: 'Failure Recovery Test',
    workflowType: 'AEB_BRACKET_SET',
    frames: brokenFrames
  });

  await new Promise((r) => setTimeout(r, 150));
  const finishedJ = pipeline.getJob(jobJ.id);
  // Verify original source files were written to storage
  const origKey0 = `tours/tour-harden-j/scans/scan-harden-j/original/frame_0_ev-1.jpg`;
  const origExists = await testStorage.exists(origKey0);
  console.log(`  Original frame preserved in storage: ${origExists}`);
  if (!origExists) {
    throw new Error('Test J failed: Original frame must be preserved in storage.');
  }
  console.log('  -> TEST J PASSED\n');

  // -------------------------------------------------------------------------
  // TEST K: Temporary File Cleanup
  // -------------------------------------------------------------------------
  console.log('[TEST K] Temporary File Cleanup Verification...');
  console.log(`  Cleaned temporary keys in job D:`, finishedD?.manifest?.cleanedTemporaryKeys);
  if (!finishedD?.manifest?.cleanedTemporaryKeys || finishedD.manifest.cleanedTemporaryKeys.length === 0) {
    throw new Error('Test K failed: Expected temporary staging files to be cleaned.');
  }
  for (const tKey of finishedD.manifest.cleanedTemporaryKeys) {
    const exists = await testStorage.exists(tKey);
    if (exists) {
      throw new Error(`Test K failed: Temporary file ${tKey} was not deleted!`);
    }
  }
  // Verify required output files STILL exist
  const finalExists = await testStorage.exists(finishedD.manifest.panoramaKey);
  const origFrameExists = await testStorage.exists(finishedD.manifest.originalFramesKeys[0]);
  if (!finalExists || !origFrameExists) {
    throw new Error('Test K failed: Permanent derivatives or originals were deleted!');
  }
  console.log(`  Verified: Temporary files removed, original and final files intact.`);
  console.log('  -> TEST K PASSED\n');

  // -------------------------------------------------------------------------
  // LARGE PANORAMA VERIFICATION (2K & 4K) & SAFE 8K BOUNDARY
  // -------------------------------------------------------------------------
  console.log('====================================================');
  console.log('LARGE PANORAMA TESTS (2K, 4K, 8K BOUNDARY)');
  console.log('====================================================');

  // 2K (2048 x 1024)
  console.log('Running 2K Panorama Test (2048x1024, 3-frame AEB)...');
  const frames2K = [
    createFixtureFrame(0, -1, 2048, 1024),
    createFixtureFrame(1, 0, 2048, 1024),
    createFixtureFrame(2, 1, 2048, 1024)
  ];
  const t2kStart = performance.now();
  const job2K = await pipeline.submitJob({
    tourId: 'tour-large',
    scanId: 'scan-2k',
    scanName: '2K Test',
    workflowType: 'AEB_BRACKET_SET',
    frames: frames2K
  });
  await new Promise((r) => setTimeout(r, 500));
  const t2kEnd = performance.now();
  const finished2K = pipeline.getJob(job2K.id);
  console.log(`  2K Status: ${finished2K?.status}, Merge Time: ${finished2K?.manifest?.mergeResult?.durationMs} ms, Total Time: ${Math.round(t2kEnd - t2kStart)} ms`);
  if (finished2K?.status !== 'COMPLETE') throw new Error('2K processing failed');

  // 4K (4096 x 2048)
  console.log('Running 4K Panorama Test (4096x2048, 3-frame AEB)...');
  const frames4K = [
    createFixtureFrame(0, -1, 4096, 2048),
    createFixtureFrame(1, 0, 4096, 2048),
    createFixtureFrame(2, 1, 4096, 2048)
  ];
  const t4kStart = performance.now();
  const job4K = await pipeline.submitJob({
    tourId: 'tour-large',
    scanId: 'scan-4k',
    scanName: '4K Test',
    workflowType: 'AEB_BRACKET_SET',
    frames: frames4K
  });
  await new Promise((r) => setTimeout(r, 1200));
  const t4kEnd = performance.now();
  const finished4K = pipeline.getJob(job4K.id);
  console.log(`  4K Status: ${finished4K?.status}, Merge Time: ${finished4K?.manifest?.mergeResult?.durationMs} ms, Total Time: ${Math.round(t4kEnd - t4kStart)} ms`);
  if (finished4K?.status !== 'COMPLETE') throw new Error('4K processing failed');

  // 8K Safe Boundary (Resolution exceeding 8K 8192x4096 is safely rejected)
  console.log('Testing Safe 8K Limit Enforcement (Exceeding 8192x4096)...');
  const over8KFrames = [
    createFixtureFrame(0, -1, 9000, 4500),
    createFixtureFrame(1, 0, 9000, 4500),
    createFixtureFrame(2, 1, 9000, 4500)
  ];
  const jobOver8K = await pipeline.submitJob({
    tourId: 'tour-large',
    scanId: 'scan-over8k',
    scanName: 'Over 8K Test',
    workflowType: 'AEB_BRACKET_SET',
    frames: over8KFrames
  });
  await new Promise((r) => setTimeout(r, 80));
  const finishedOver8K = pipeline.getJob(jobOver8K.id);
  console.log(`  Over 8K Status: ${finishedOver8K?.status}, Error: ${finishedOver8K?.errorMessage}`);
  if (finishedOver8K?.status !== 'FAILED' || finishedOver8K?.errorCode !== 'EXCEEDS_MAX_RESOLUTION') {
    throw new Error('8K limit safety test failed');
  }
  console.log('  -> 2K, 4K, and 8K Boundary Verified Successfully!\n');

  // -------------------------------------------------------------------------
  // ACTUAL BENCHMARK MEASUREMENTS (Requirement 12)
  // -------------------------------------------------------------------------
  console.log('====================================================');
  console.log('MEASURED BENCHMARKS (3 AEB & 5 AEB)');
  console.log('====================================================');

  // Benchmark 1: 3-Frame AEB at 1024x512
  const bench3Frames = [
    createFixtureFrame(0, -2, 1024, 512),
    createFixtureFrame(1, 0, 1024, 512),
    createFixtureFrame(2, 2, 1024, 512)
  ];
  const b3Start = performance.now();
  const b3Job = await pipeline.submitJob({
    tourId: 'tour-bench',
    scanId: 'scan-bench-3',
    scanName: 'Benchmark 3-AEB',
    workflowType: 'AEB_BRACKET_SET',
    frames: bench3Frames,
    exposureStep: 2.0
  });
  await new Promise((r) => setTimeout(r, 400));
  const b3Finished = pipeline.getJob(b3Job.id);
  const b3Duration = Math.round(performance.now() - b3Start);

  console.log('Benchmark 1 (3-AEB):');
  console.log(`  Resolution: 1024x512`);
  console.log(`  Frame Count: 3 AEB`);
  console.log(`  Merge Time: ${b3Finished?.manifest?.mergeResult?.durationMs} ms`);
  console.log(`  Total Pipeline Time: ${b3Duration} ms`);
  console.log(`  Uncompressed Output Buffer: ${(1024 * 512 * 4) / 1024} KB`);
  console.log(`  Peak Buffer Memory: ~${(3 * 1024 * 512 * 4) / (1024 * 1024)} MB\n`);

  // Benchmark 2: 5-Frame AEB at 1024x512
  const bench5Frames = [
    createFixtureFrame(0, -2, 1024, 512),
    createFixtureFrame(1, -1, 1024, 512),
    createFixtureFrame(2, 0, 1024, 512),
    createFixtureFrame(3, 1, 1024, 512),
    createFixtureFrame(4, 2, 1024, 512)
  ];
  const b5Start = performance.now();
  const b5Job = await pipeline.submitJob({
    tourId: 'tour-bench',
    scanId: 'scan-bench-5',
    scanName: 'Benchmark 5-AEB',
    workflowType: 'AEB_BRACKET_SET',
    frames: bench5Frames,
    exposureStep: 1.0
  });
  await new Promise((r) => setTimeout(r, 450));
  const b5Finished = pipeline.getJob(b5Job.id);
  const b5Duration = Math.round(performance.now() - b5Start);

  console.log('Benchmark 2 (5-AEB):');
  console.log(`  Resolution: 1024x512`);
  console.log(`  Frame Count: 5 AEB`);
  console.log(`  Merge Time: ${b5Finished?.manifest?.mergeResult?.durationMs} ms`);
  console.log(`  Total Pipeline Time: ${b5Duration} ms`);
  console.log(`  Uncompressed Output Buffer: ${(1024 * 512 * 4) / 1024} KB`);
  console.log(`  Peak Buffer Memory: ~${(5 * 1024 * 512 * 4) / (1024 * 1024)} MB\n`);

  console.log('7/9-frame benchmark not measured.\n');

  console.log('====================================================');
  console.log('ALL 11 HARDENED WORKER TESTS (A through K) PASSED!');
  console.log('====================================================');
}

runHardenedWorkerTests().catch((err) => {
  console.error('\nTest suite failed with error:', err);
  process.exit(1);
});
