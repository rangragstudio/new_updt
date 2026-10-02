/**
 * ============================================================================
 * Insta360 Camera Provider (Native Bridge Architecture)
 * ============================================================================
 *
 * Implements the CameraProvider interface for Insta360 dual-lens 360° cameras
 * (Insta360 X4, X3, ONE RS 1-Inch, ONE X2, Sphere) using the clean Native
 * Integration Bridge pattern.
 *
 * Key Architecture Guarantees:
 * 1. Web App Safety: No native C++ binaries or credentials loaded in React.
 * 2. True Hardware Fidelity: ZERO fake battery, synthetic storage, or simulated
 *    hardware connections. If SDK or bridge is unconfigured, state remains
 *    strictly 'INSTA360_SDK_NOT_CONFIGURED'.
 * 3. Dynamic Capability Discovery: Does NOT hard-code 3/5/7 AEB as universal;
 *    queries actual camera-reported capabilities.
 * 4. Strict Validation: Never silently alters 5 AEB -> 3 AEB. Returns explicit
 *    AEB_FRAME_COUNT_NOT_SUPPORTED or EXPOSURE_STEP_NOT_SUPPORTED.
 * 5. Fast Capture Flow:
 *    - Single onboard HDR: Dispatched as SINGLE_HDR_PANORAMA (no second merge).
 *    - AEB Brackets: Downloaded and enqueued into background HDR pipeline.
 * ============================================================================
 */

import {
  CameraProvider,
  CameraInfo,
  CameraCapabilities,
  CameraConnectionState,
  CameraStatus,
  CameraMedia,
  CameraCaptureResult,
  BatteryStatus,
  StorageStatus,
  IMUData,
  CameraError,
  HDRCapabilities,
  HDRCaptureConfig,
  HDRCaptureResult,
  HDRValidationResult,
  HDRBracketFrame,
  DEFAULT_UNSUPPORTED_HDR_CAPABILITIES,
  validateHDRConfigAgainstCapabilities
} from './CameraProvider';

import {
  IInsta360NativeBridge,
  insta360NativeBridge
} from './insta360/Insta360NativeBridge';

import {
  Insta360CameraError,
  Insta360DeviceDescriptor,
  Insta360DeviceCapabilities
} from './insta360/Insta360Types';

import { hdrWorkerPipeline, FrameInputPayload } from '../processing/HDRWorkerPipeline';

export class Insta360Provider implements CameraProvider {
  public readonly id = 'insta360';
  public readonly name = 'Insta360 Camera';
  public readonly type = 'INSTA360' as const;

  // Static fallback capability flags when disconnected / unconfigured
  public readonly capabilities: CameraCapabilities = {
    preview: false,
    capture: false,
    mediaDownload: false,
    mediaDelete: false,
    battery: false,
    storage: false,
    imu: false,
    stitching: false
  };

  private bridge: IInsta360NativeBridge;
  private connectedDevice: Insta360DeviceDescriptor | null = null;
  private cachedCapabilities: Insta360DeviceCapabilities | null = null;

  constructor(bridge?: IInsta360NativeBridge) {
    this.bridge = bridge || insta360NativeBridge;
  }

  public getBridge(): IInsta360NativeBridge {
    return this.bridge;
  }

  public getInfo(): CameraInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      model: this.connectedDevice ? this.connectedDevice.model : 'Insta360 X3 / X4 / ONE RS (Adapter Ready)',
      manufacturer: 'Insta360'
    };
  }

  public getCapabilities(): CameraCapabilities {
    const isConn = this.getConnectionState() === 'CONNECTED';
    return {
      preview: isConn && (this.cachedCapabilities?.isLivePreviewSupported ?? false),
      capture: isConn,
      mediaDownload: isConn,
      mediaDelete: isConn,
      battery: isConn,
      storage: isConn,
      imu: false,
      stitching: isConn
    };
  }

  public getConnectionState(): CameraConnectionState {
    const bridgeStatus = this.bridge.getConnectionStatus();
    if (bridgeStatus === 'SDK_NOT_CONFIGURED') {
      return 'INSTA360_SDK_NOT_CONFIGURED';
    }
    if (bridgeStatus === 'CONNECTED') {
      return 'CONNECTED';
    }
    return 'DISCONNECTED';
  }

  public getStatus(): CameraStatus {
    const state = this.getConnectionState();
    if (state === 'INSTA360_SDK_NOT_CONFIGURED') {
      const missing = this.bridge.getMissingPrerequisites();
      return {
        state,
        battery: null,
        storage: null,
        firmwareVersion: null,
        errorMessage: `Insta360 native bridge is not configured: ${missing.join('; ')}`
      };
    }

    return {
      state,
      battery: null,
      storage: null,
      firmwareVersion: this.connectedDevice?.firmwareVersion || null,
      errorMessage: null
    };
  }

  public async discover(): Promise<boolean> {
    if (!this.bridge.isSdkConfigured()) {
      return false;
    }

    try {
      const device = await this.bridge.discoverCamera();
      if (device) {
        this.connectedDevice = device;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async connect(): Promise<boolean> {
    if (!this.bridge.isSdkConfigured()) {
      throw new CameraError(
        'Cannot connect: Insta360 native SDK is not configured in this environment.',
        'INSTA360_SDK_NOT_CONFIGURED',
        this.type
      );
    }

    try {
      const targetDevice = this.connectedDevice || (await this.bridge.discoverCamera());
      if (!targetDevice) {
        throw new CameraError('No Insta360 camera found.', 'CAMERA_NOT_FOUND', this.type);
      }

      const ok = await this.bridge.connect(targetDevice.deviceId);
      if (ok) {
        this.connectedDevice = targetDevice;
        this.cachedCapabilities = await this.bridge.getCapabilities();
        return true;
      }
      return false;
    } catch (err: any) {
      const code = err instanceof Insta360CameraError ? err.code : 'CONNECTION_FAILED';
      throw new CameraError(err.message, code, this.type);
    }
  }

  public async disconnect(): Promise<void> {
    await this.bridge.disconnect();
    this.connectedDevice = null;
    this.cachedCapabilities = null;
  }

  public async startPreview(): Promise<MediaStream | null> {
    return this.bridge.getLivePreviewStream();
  }

  public async stopPreview(): Promise<void> {
    // No-op
  }

  public async capture(): Promise<CameraCaptureResult> {
    if (!this.bridge.isSdkConfigured() || this.getConnectionState() !== 'CONNECTED') {
      throw new CameraError(
        'Capture failed: Camera is not connected or SDK is not configured.',
        this.bridge.isSdkConfigured() ? 'CAMERA_DISCONNECTED' : 'INSTA360_SDK_NOT_CONFIGURED',
        this.type
      );
    }

    try {
      const res = await this.bridge.capture({ mode: 'normal' });
      const firstFile = res.files[0];
      const blob = firstFile ? await this.bridge.downloadFile(firstFile.fileUrl) : new Blob();

      return {
        blob,
        url: firstFile?.fileUrl || '',
        timestamp: res.timestamp,
        metadata: {
          width: 5760,
          height: 2880,
          is360Equirectangular: true
        }
      };
    } catch (err: any) {
      const code = err instanceof Insta360CameraError ? err.code : 'CAPTURE_FAILED';
      throw new CameraError(err.message, code, this.type);
    }
  }

  public async listMedia(): Promise<CameraMedia[]> {
    const files = await this.bridge.listFiles();
    return files.map((f) => ({
      id: f.fileId,
      name: f.filename,
      sizeBytes: f.sizeBytes,
      createdAt: new Date(f.createdAt).toISOString(),
      mimeType: f.mimeType,
      downloadUrl: f.fileUrl
    }));
  }

  public async downloadMedia(mediaId: string): Promise<Blob> {
    return this.bridge.downloadFile(mediaId);
  }

  public async deleteMedia(mediaId: string): Promise<boolean> {
    return this.bridge.deleteFile(mediaId);
  }

  public async getIMUData(): Promise<IMUData | null> {
    return null;
  }

  public async getBatteryLevel(): Promise<BatteryStatus | null> {
    if (!this.bridge.isSdkConfigured() || this.getConnectionState() !== 'CONNECTED') {
      return null;
    }
    const state = await this.bridge.getCameraState();
    if (state.batteryLevelPercent === null) return null;
    return {
      levelPercent: state.batteryLevelPercent,
      isCharging: state.isBatteryCharging ?? false
    };
  }

  public async getStorageStatus(): Promise<StorageStatus | null> {
    if (!this.bridge.isSdkConfigured() || this.getConnectionState() !== 'CONNECTED') {
      return null;
    }
    const state = await this.bridge.getCameraState();
    if (state.storageRemainingBytes === null || state.storageTotalBytes === null) {
      return null;
    }
    return {
      totalBytes: state.storageTotalBytes,
      freeBytes: state.storageRemainingBytes
    };
  }

  // =========================================================================
  // DYNAMIC HDR & AEB CAPABILITIES & CONTROLS (Requirements 5, 6, 7, 8, 9)
  // =========================================================================

  public getHDRCapabilities(): HDRCapabilities {
    if (!this.bridge.isSdkConfigured() || this.getConnectionState() !== 'CONNECTED' || !this.cachedCapabilities) {
      return DEFAULT_UNSUPPORTED_HDR_CAPABILITIES;
    }

    const c = this.cachedCapabilities;
    return {
      hdrSupported: c.isHDRSupported,
      aebSupported: c.isAEBSupported,
      supportedAebFrameCounts: [...c.supportedAEBFrameCounts],
      supportedExposureSteps: [...c.supportedExposureSteps],
      rawSupported: c.supportedFormats.includes('RAW') || c.supportedFormats.includes('RAW+JPEG'),
      jpegSupported: c.supportedFormats.includes('JPEG'),
      cameraSideHdrSupported: c.isCameraSideHDRSupported,
      bracketedFramesAvailable: c.isAEBSupported,
      hdrMergeSupported: c.isCameraSideHDRSupported
    };
  }

  public validateHDRConfig(config: HDRCaptureConfig): HDRValidationResult {
    return validateHDRConfigAgainstCapabilities(
      config,
      this.getHDRCapabilities(),
      this.getConnectionState() === 'CONNECTED',
      this.bridge.isSdkConfigured()
    );
  }

  /**
   * Execute real HDR/AEB capture workflow through the native bridge.
   * Dispatches results to RenderWalk background worker without blocking camera flow.
   */
  public async captureHDR(config: HDRCaptureConfig): Promise<HDRCaptureResult> {
    if (!this.bridge.isSdkConfigured()) {
      throw new CameraError(
        'Insta360 HDR capture unavailable: SDK_NOT_CONFIGURED. Official SDK bridge must be connected.',
        'SDK_NOT_CONFIGURED',
        this.type
      );
    }

    if (this.getConnectionState() !== 'CONNECTED') {
      throw new CameraError(
        'Insta360 camera is disconnected. Please connect before capturing.',
        'CAMERA_DISCONNECTED',
        this.type
      );
    }

    // Dynamic Capability Verification (Requirement 6 - Never silently alter values)
    const caps = this.getHDRCapabilities();

    if (config.mode === 'AEB') {
      if (!caps.aebSupported) {
        throw new CameraError('AEB bracketing is not supported by this camera model.', 'AEB_NOT_SUPPORTED', this.type);
      }
      if (!config.frameCount || !caps.supportedAebFrameCounts.includes(config.frameCount)) {
        throw new CameraError(
          `Requested ${config.frameCount} AEB frames is not supported by this camera. Supported frame counts: ${caps.supportedAebFrameCounts.join(', ')}.`,
          'AEB_FRAME_COUNT_NOT_SUPPORTED',
          this.type
        );
      }
      const step = config.exposureStep ?? 1.0;
      if (!caps.supportedExposureSteps.includes(step)) {
        throw new CameraError(
          `Requested exposure step ±${step} EV is not supported. Supported steps: ${caps.supportedExposureSteps.join(', ')}.`,
          'EXPOSURE_STEP_NOT_SUPPORTED',
          this.type
        );
      }
    }

    // Battery & Storage Safety Checks
    const battery = await this.getBatteryLevel();
    if (battery && battery.levelPercent < 10 && !battery.isCharging) {
      throw new CameraError('Insta360 battery too low for multi-exposure capture (< 10%).', 'LOW_BATTERY', this.type);
    }

    const storage = await this.getStorageStatus();
    if (storage && storage.freeBytes < 50 * 1024 * 1024) {
      throw new CameraError('Insta360 camera storage full.', 'STORAGE_FULL', this.type);
    }

    try {
      const exposureStep = config.exposureStep ?? 1.0;
      // Dispatch capture command through the native bridge
      const bridgeCaptureResult = await this.bridge.capture({
        mode: config.mode === 'AEB' ? 'bracket' : 'hdr',
        bracketParams:
          config.mode === 'AEB' && config.frameCount
            ? {
                count: config.frameCount,
                step: exposureStep as any,
                format: 'JPEG'
              }
            : undefined
      });

      // Requirement 8: Single HDR Panorama Fast-Track
      if (bridgeCaptureResult.isHDRMerged || bridgeCaptureResult.files.length === 1) {
        const fileInfo = bridgeCaptureResult.files[0];
        const blob = await this.bridge.downloadFile(fileInfo.fileUrl);

        // Enqueue into RenderWalk background worker as SINGLE_HDR_PANORAMA (bypasses second HDR merge)
        const framePayload: FrameInputPayload = {
          frameIndex: 0,
          evOffset: 0,
          filename: fileInfo.filename,
          mimeType: fileInfo.mimeType || 'image/jpeg',
          width: 5760,
          height: 2880,
          data: new Uint8Array(await blob.arrayBuffer()),
          captureTimestamp: fileInfo.createdAt,
          sourceCamera: bridgeCaptureResult.cameraModel
        };

        const job = await hdrWorkerPipeline.submitJob({
          tourId: 'active-tour',
          scanId: bridgeCaptureResult.captureGroupId,
          scanName: `Insta360 Onboard HDR ${new Date(bridgeCaptureResult.timestamp).toLocaleTimeString()}`,
          workflowType: 'SINGLE_HDR_PANORAMA',
          frames: [framePayload]
        });

        return {
          status: 'COMPLETED',
          mode: 'HDR',
          mergeMode: 'CAMERA',
          bracketFrames: [],
          cameraSideHdrResult: {
            blob,
            url: fileInfo.fileUrl,
            mediaId: fileInfo.fileId,
            timestamp: bridgeCaptureResult.timestamp
          },
          downloadedMediaReferences: [fileInfo.fileId],
          processingStatus: 'READY'
        };
      }

      // Requirement 9: AEB Multi-frame Capture Set
      const downloadedFrames: FrameInputPayload[] = [];
      const bracketFramesOut: HDRBracketFrame[] = [];
      const mediaRefs: string[] = [];

      for (let i = 0; i < bridgeCaptureResult.files.length; i++) {
        const fileInfo = bridgeCaptureResult.files[i];
        const blob = await this.bridge.downloadFile(fileInfo.fileUrl);
        const ev = fileInfo.evOffset ?? (i - Math.floor(bridgeCaptureResult.files.length / 2)) * exposureStep;

        mediaRefs.push(fileInfo.fileId);
        bracketFramesOut.push({
          frameIndex: fileInfo.frameIndex ?? i,
          evOffset: ev,
          blob,
          url: fileInfo.fileUrl,
          mediaId: fileInfo.fileId,
          timestamp: fileInfo.createdAt
        });

        downloadedFrames.push({
          frameIndex: fileInfo.frameIndex ?? i,
          evOffset: ev,
          filename: fileInfo.filename,
          mimeType: fileInfo.mimeType || 'image/jpeg',
          width: 5760,
          height: 2880,
          data: new Uint8Array(await blob.arrayBuffer()),
          captureTimestamp: fileInfo.createdAt,
          sourceCamera: bridgeCaptureResult.cameraModel
        });
      }

      // Enqueue as AEB_BRACKET_SET into background worker pipeline without blocking
      await hdrWorkerPipeline.submitJob({
        tourId: 'active-tour',
        scanId: bridgeCaptureResult.captureGroupId,
        scanName: `Insta360 ${config.frameCount}-AEB ${new Date(bridgeCaptureResult.timestamp).toLocaleTimeString()}`,
        workflowType: 'AEB_BRACKET_SET',
        frames: downloadedFrames,
        exposureStep
      });

      return {
        status: 'COMPLETED',
        mode: 'AEB',
        mergeMode: 'RENDERWALK',
        bracketFrames: bracketFramesOut,
        downloadedMediaReferences: mediaRefs,
        processingStatus: 'PENDING'
      };
    } catch (err: any) {
      if (err instanceof CameraError) throw err;
      const code = err instanceof Insta360CameraError ? err.code : 'CAPTURE_FAILED';
      throw new CameraError(err.message, code, this.type);
    }
  }

  // --- Compatibility Aliases ---
  public async getPreviewStream(): Promise<MediaStream | null> {
    return this.startPreview();
  }

  public async capturePhoto(): Promise<CameraCaptureResult> {
    return this.capture();
  }

  public async getOrientation(): Promise<IMUData | null> {
    return this.getIMUData();
  }

  public async getBatteryStatus(): Promise<BatteryStatus | null> {
    return this.getBatteryLevel();
  }
}
