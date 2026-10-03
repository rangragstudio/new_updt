/**
 * ============================================================================
 * Development-Only Camera Test Provider (RenderWalk Internal)
 * ============================================================================
 *
 * IMPORTANT / PRODUCTION SAFETY RULES:
 * 1. MARKED: DEVELOPMENT ONLY — NEVER USE IN PRODUCTION.
 * 2. ZERO FAKE HARDWARE:
 *    - Never returns synthetic battery percentages, IMU, or storage values.
 *    - Never produces a fake video stream for camera preview.
 *    - Never claims to be Insta360 or GoPro.
 * 3. REAL FIXTURE INTEGRATION:
 *    - Uses real image files from project test fixtures (fixtures/ directory).
 *    - If a fixture does not exist (e.g. 7-frame or 9-frame AEB), it strictly
 *      reports FIXTURE_NOT_AVAILABLE without fabricating mock frames.
 * 4. ACTUAL TIMINGS:
 *    - Zero artificial delays to simulate a camera. Measures real processing time.
 * ============================================================================
 */

import { CameraProvider } from './CameraProvider';
import {
  CameraInfo,
  CameraCapabilities,
  CameraConnectionState,
  CameraStatus,
  CameraMedia,
  CameraCaptureResult,
  BatteryStatus,
  StorageStatus,
  IMUData,
  CameraError
} from './CameraCapabilities';
import {
  HDRCapabilities,
  HDRCaptureConfig,
  HDRCaptureResult,
  HDRValidationResult,
  HDRValidationIssue,
  HDRBracketFrame,
  AEBFrameCount
} from './HDRCapabilities';
import {
  HDRWorkerPipeline,
  FrameInputPayload,
  InputWorkflowType,
  StandardJobState,
  StageTimings
} from '../processing/HDRWorkerPipeline';
import { storageService } from '../storage/StorageService';
import { hdrMergeEngine } from '../processing/HDRMergeEngine';
import * as fs from 'fs';
import * as path from 'path';

export const FIXTURE_NOT_AVAILABLE = 'FIXTURE_NOT_AVAILABLE';

/**
 * Checks whether the development camera is explicitly permitted.
 */
export function isDevelopmentCameraEnabled(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env?.NODE_ENV !== 'production' || process.env?.VITE_ENABLE_DEV_CAMERA === 'true')
  );
}

export class DevelopmentCameraProvider implements CameraProvider {
  public readonly id = 'dev-camera-test-provider';
  public readonly name = 'Development Camera Test Provider (DEVELOPMENT ONLY)';
  public readonly type = 'DEVELOPMENT_TEST' as const;

  private connectionState: CameraConnectionState = 'DISCONNECTED';
  private fixturesRoot: string;

  public readonly capabilities: CameraCapabilities = {
    preview: false,      // Strictly false: No fake camera preview
    capture: true,      // Allows software test capture using real fixtures
    mediaDownload: true,
    mediaDelete: false,
    battery: false,      // Strictly false: No fake battery level
    storage: false,      // Strictly false: No fake storage metrics
    imu: false,          // Strictly false: No fake IMU orientation
    stitching: false
  };

  constructor(customFixturesPath?: string) {
    if (customFixturesPath) {
      this.fixturesRoot = customFixturesPath;
    } else {
      this.fixturesRoot = path.resolve(process.cwd(), 'fixtures');
    }
  }

  public getInfo(): CameraInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      manufacturer: 'RenderWalk Internal (DEVELOPMENT ONLY)',
      model: 'Software Test Rig (NO PHYSICAL HARDWARE)',
      firmwareVersion: 'DEV-FIXTURE-v1.0'
    };
  }

  public getCapabilities(): CameraCapabilities {
    return this.capabilities;
  }

  public async connect(): Promise<boolean> {
    this.connectionState = 'CONNECTED';
    return true;
  }

  public async disconnect(): Promise<void> {
    this.connectionState = 'DISCONNECTED';
  }

  public getConnectionState(): CameraConnectionState {
    return this.connectionState;
  }

  public getStatus(): CameraStatus {
    return {
      state: this.connectionState,
      battery: null,          // Real hardware status: null (no fake telemetry)
      storage: null,          // Real hardware status: null (no fake telemetry)
      firmwareVersion: 'DEV-FIXTURE-v1.0',
      errorMessage: null
    };
  }

  public async startPreview(): Promise<MediaStream | null> {
    // Strictly null: zero fake video feeds
    return null;
  }

  public async stopPreview(): Promise<void> {
    // No-op
  }

  public async getBatteryLevel(): Promise<BatteryStatus | null> {
    return null;
  }

  public async getStorageStatus(): Promise<StorageStatus | null> {
    return null;
  }

  public async getIMUData(): Promise<IMUData | null> {
    return null;
  }

  public async discover(): Promise<boolean> {
    return true;
  }

  public getHDRCapabilities(): HDRCapabilities {
    // Exposes capabilities strictly aligned with available fixtures
    return {
      hdrSupported: true,
      aebSupported: true,
      supportedAebFrameCounts: [3, 5] as readonly AEBFrameCount[], // Real fixtures available for 3 and 5 only
      supportedExposureSteps: [0.5, 1.0, 1.5, 2.0],
      rawSupported: true,
      jpegSupported: true,
      cameraSideHdrSupported: true, // SINGLE_HDR_PANORAMA fixture
      bracketedFramesAvailable: true,
      hdrMergeSupported: true
    };
  }

  public validateHDRConfig(config: HDRCaptureConfig): HDRValidationResult {
    const issues: HDRValidationIssue[] = [];
    if (config.mode === 'AEB') {
      const count = config.frameCount;
      if (count === 7 || count === 9) {
        issues.push({
          code: 'UNSUPPORTED_FRAME_COUNT',
          message: `Fixture for ${count}-frame AEB is not available in project fixtures directory (${FIXTURE_NOT_AVAILABLE}).`
        });
      } else if (count !== 3 && count !== 5) {
        issues.push({
          code: 'UNSUPPORTED_FRAME_COUNT',
          message: `Unsupported bracket count ${count}. Available test fixtures: 3, 5.`
        });
      }
    }
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  public async capture(): Promise<CameraCaptureResult> {
    const filePath = path.join(this.fixturesRoot, 'single_normal', 'panorama.jpg');
    if (!fs.existsSync(filePath)) {
      throw new CameraError(
        `Normal panorama fixture not found at: ${filePath}`,
        FIXTURE_NOT_AVAILABLE,
        this.type
      );
    }

    const buffer = fs.readFileSync(filePath);
    const blob = new Blob([buffer], { type: 'image/jpeg' });

    return {
      blob,
      url: URL.createObjectURL ? URL.createObjectURL(blob) : `file://${filePath}`,
      timestamp: Date.now(),
      metadata: {
        width: 2048,
        height: 1024,
        is360Equirectangular: true
      }
    };
  }

  public async captureHDR(config: HDRCaptureConfig): Promise<HDRCaptureResult> {
    const validation = this.validateHDRConfig(config);
    if (!validation.isValid) {
      throw new CameraError(
        `Development capture rejected: ${validation.issues.map((i) => i.message).join('; ')}`,
        FIXTURE_NOT_AVAILABLE,
        this.type
      );
    }

    // Mode A: SINGLE_HDR_PANORAMA
    if (config.mode === 'HDR') {
      const filePath = path.join(this.fixturesRoot, 'single_hdr', 'panorama.jpg');
      if (!fs.existsSync(filePath)) {
        throw new CameraError(
          `Single HDR fixture not found at: ${filePath}`,
          FIXTURE_NOT_AVAILABLE,
          this.type
        );
      }

      const buffer = fs.readFileSync(filePath);
      const blob = new Blob([buffer], { type: 'image/jpeg' });

      return {
        status: 'COMPLETED',
        mode: config.mode,
        mergeMode: config.mergeMode,
        bracketFrames: [],
        cameraSideHdrResult: {
          blob,
          url: URL.createObjectURL ? URL.createObjectURL(blob) : `file://${filePath}`,
          mediaId: 'dev-fixture-hdr',
          timestamp: Date.now()
        },
        downloadedMediaReferences: [filePath],
        processingStatus: 'READY'
      };
    }

    // Mode B: AEB_BRACKET_SET
    const frameCount = config.frameCount || 3;
    const fixtureDir = path.join(this.fixturesRoot, `aeb_${frameCount}`);

    if (!fs.existsSync(fixtureDir)) {
      throw new CameraError(
        `AEB ${frameCount} fixture folder not found at: ${fixtureDir}`,
        FIXTURE_NOT_AVAILABLE,
        this.type
      );
    }

    const files = fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.jpg') || f.endsWith('.jpeg')).sort();
    if (files.length < frameCount) {
      throw new CameraError(
        `Insufficient frames in ${fixtureDir}. Required: ${frameCount}, found: ${files.length}`,
        FIXTURE_NOT_AVAILABLE,
        this.type
      );
    }

    const bracketFrames: HDRBracketFrame[] = files.slice(0, frameCount).map((fileName, idx) => {
      const fullPath = path.join(fixtureDir, fileName);
      const buf = fs.readFileSync(fullPath);
      const blob = new Blob([buf], { type: 'image/jpeg' });
      const step = config.exposureStep || 1.0;
      const center = Math.floor(frameCount / 2);
      const evOffset = (idx - center) * step;

      return {
        frameIndex: idx,
        evOffset,
        blob,
        url: URL.createObjectURL ? URL.createObjectURL(blob) : `file://${fullPath}`,
        mediaId: `dev-frame-${idx}`,
        timestamp: Date.now()
      };
    });

    return {
      status: 'COMPLETED',
      mode: config.mode,
      mergeMode: config.mergeMode,
      bracketFrames,
      downloadedMediaReferences: bracketFrames.map((f) => f.mediaId || ''),
      processingStatus: 'READY'
    };
  }

  public async listMedia(): Promise<CameraMedia[]> {
    return [];
  }

  public async downloadMedia(_mediaId: string): Promise<Blob> {
    throw new CameraError('Method not supported on development rig', 'UNSUPPORTED', this.type);
  }

  public async deleteMedia(_mediaId: string): Promise<boolean> {
    return false;
  }

  /**
   * Exercises complete RenderWalk software pipeline end-to-end:
   * select test capture → create capture group → upload/handoff → processing queue
   * → HDR processing → panorama output → tiles → viewer
   */
  public async exercisePipeline(options: {
    workflow: 'NORMAL_PANORAMA' | 'SINGLE_HDR_PANORAMA' | 'AEB_3' | 'AEB_5' | 'AEB_7' | 'AEB_9';
    tourId: string;
    scanId: string;
    scanName?: string;
  }): Promise<{
    success: boolean;
    jobId: string;
    workflow: InputWorkflowType;
    durationMs: number;
    standardStatus?: StandardJobState;
    timings?: StageTimings;
    panoramaUrl?: string;
    tilesBaseUrl?: string;
    manifest?: any;
    error?: string;
  }> {
    const startTime = performance.now();
    const pipeline = new HDRWorkerPipeline(storageService, hdrMergeEngine, { maxConcurrency: 1 });

    let workflowType: InputWorkflowType;
    let frames: FrameInputPayload[];

    if (options.workflow === 'NORMAL_PANORAMA') {
      workflowType = 'NORMAL_PANORAMA';
      const cap = await this.capture();
      const ab = await cap.blob.arrayBuffer();
      frames = [
        {
          frameIndex: 0,
          evOffset: 0,
          filename: 'normal_panorama.jpg',
          mimeType: 'image/jpeg',
          width: cap.metadata?.width || 2048,
          height: cap.metadata?.height || 1024,
          data: new Uint8Array(ab),
          captureTimestamp: Date.now(),
          sourceCamera: 'DevelopmentCameraProvider'
        }
      ];
    } else if (options.workflow === 'SINGLE_HDR_PANORAMA') {
      workflowType = 'SINGLE_HDR_PANORAMA';
      const cap = await this.captureHDR({
        mode: 'HDR',
        outputFormat: 'JPEG',
        mergeMode: 'CAMERA'
      });
      const blob = cap.cameraSideHdrResult?.blob;
      if (!blob) {
        throw new Error('Missing cameraSideHdrResult blob in SINGLE_HDR_PANORAMA test');
      }
      const ab = await blob.arrayBuffer();
      frames = [
        {
          frameIndex: 0,
          evOffset: 0,
          filename: 'single_hdr_panorama.jpg',
          mimeType: 'image/jpeg',
          width: 4096,
          height: 2048,
          data: new Uint8Array(ab),
          captureTimestamp: Date.now(),
          sourceCamera: 'DevelopmentCameraProvider'
        }
      ];
    } else {
      // AEB mode
      workflowType = 'AEB_BRACKET_SET';
      const count = parseInt(options.workflow.replace('AEB_', ''), 10) as AEBFrameCount;
      if (count === 7 || count === 9) {
        throw new Error(`${FIXTURE_NOT_AVAILABLE}: No fixture available for ${count}-frame AEB.`);
      }

      const cap = await this.captureHDR({
        mode: 'AEB',
        frameCount: count,
        exposureStep: 1.0,
        outputFormat: 'JPEG',
        mergeMode: 'RENDERWALK'
      });

      frames = await Promise.all(
        cap.bracketFrames.map(async (f) => {
          const blob = f.blob || new Blob();
          const ab = await blob.arrayBuffer();
          return {
            frameIndex: f.frameIndex ?? 0,
            evOffset: f.evOffset ?? 0,
            filename: `frame_${f.frameIndex}.jpg`,
            mimeType: 'image/jpeg',
            width: 2048,
            height: 1024,
            data: new Uint8Array(ab),
            captureTimestamp: Date.now(),
            sourceCamera: 'DevelopmentCameraProvider'
          };
        })
      );
    }

    const job = await pipeline.submitJob({
      tourId: options.tourId,
      scanId: options.scanId,
      scanName: options.scanName || 'Dev Test Scan',
      workflowType,
      frames
    });

    // Wait for job completion
    let finishedJob = pipeline.getJob(job.id);
    let attempts = 0;
    while (finishedJob && finishedJob.status !== 'COMPLETE' && finishedJob.status !== 'FAILED' && attempts < 200) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      finishedJob = pipeline.getJob(job.id);
      attempts++;
    }

    const totalDuration = Math.round(performance.now() - startTime);

    if (!finishedJob || finishedJob.status !== 'COMPLETE') {
      return {
        success: false,
        jobId: job.id,
        workflow: workflowType,
        durationMs: totalDuration,
        error: finishedJob?.errorMessage || finishedJob?.errorCode || 'Processing failed'
      };
    }

    return {
      success: true,
      jobId: job.id,
      workflow: workflowType,
      durationMs: totalDuration,
      standardStatus: finishedJob.standardStatus,
      timings: finishedJob.timings,
      panoramaUrl: finishedJob.panoramaUrl || finishedJob.manifest?.panoramaKey,
      tilesBaseUrl: finishedJob.tileManifestUrl || finishedJob.manifest?.tilesManifestKey,
      manifest: finishedJob.manifest
    };
  }
}
