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
  DEFAULT_UNSUPPORTED_HDR_CAPABILITIES,
  validateHDRConfigAgainstCapabilities
} from './CameraProvider';

/**
 * PhoneCameraProvider
 * Implements CameraProvider for the host smartphone/tablet browser camera.
 * Uses standard HTML5 MediaDevices (getUserMedia) and DeviceOrientationEvent.
 *
 * Explicit Capabilities:
 * - preview: true (via MediaStream)
 * - capture: true (canvas snapshot from video stream)
 * - imu: true (via device orientation sensors if supported by hardware)
 * - mediaDownload: false (no remote hardware SD card)
 * - mediaDelete: false
 * - battery: false (no hardware camera battery reporting)
 * - storage: false (no onboard camera storage)
 * - stitching: false (panoramas are single captures or processed downstream)
 * - HDR/AEB: Browser camera does not provide manual multi-exposure RAW bracketing.
 */
export class PhoneCameraProvider implements CameraProvider {
  public readonly id = 'phone-camera';
  public readonly name = 'Phone Camera';
  public readonly type = 'PHONE' as const;

  public readonly capabilities: CameraCapabilities = {
    preview: true,
    capture: true,
    mediaDownload: false,
    mediaDelete: false,
    battery: false,
    storage: false,
    imu: true,
    stitching: false
  };

  private state: CameraConnectionState = 'DISCONNECTED';
  private activeStream: MediaStream | null = null;
  private currentOrientation: IMUData | null = null;
  private orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;
  private lastErrorMessage: string | null = null;

  public getInfo(): CameraInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      model: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser Host',
      manufacturer: 'Host Device'
    };
  }

  public getCapabilities(): CameraCapabilities {
    return this.capabilities;
  }

  public getConnectionState(): CameraConnectionState {
    return this.state;
  }

  public getStatus(): CameraStatus {
    return {
      state: this.state,
      battery: null, // Phone camera does not report dedicated camera battery
      storage: null, // Host phone does not expose camera SD card
      firmwareVersion: null,
      errorMessage: this.lastErrorMessage
    };
  }

  public async discover(): Promise<boolean> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      this.state = 'UNAVAILABLE';
      return false;
    }

    try {
      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some((d) => d.kind === 'videoinput');
        return hasVideo;
      }
      return true;
    } catch {
      return false;
    }
  }

  public async connect(): Promise<boolean> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      this.state = 'UNAVAILABLE';
      this.lastErrorMessage = 'MediaDevices API unavailable on this browser/device.';
      return false;
    }

    this.state = 'CONNECTING';
    this.lastErrorMessage = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      this.activeStream = stream;
      this.state = 'CONNECTED';
      this.initOrientationListener();
      return true;
    } catch (err: any) {
      this.state = 'ERROR';
      this.lastErrorMessage = err?.message || 'Camera permission denied or camera unavailable.';
      console.warn('PhoneCameraProvider connect failed:', err);
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = null;
    }
    this.removeOrientationListener();
    this.state = 'DISCONNECTED';
    this.lastErrorMessage = null;
  }

  public async startPreview(): Promise<MediaStream | null> {
    if (!this.activeStream || this.state !== 'CONNECTED') {
      const connected = await this.connect();
      if (!connected) return null;
    }
    return this.activeStream;
  }

  public async stopPreview(): Promise<void> {
    await this.disconnect();
  }

  public async capture(): Promise<CameraCaptureResult> {
    if (!this.activeStream || this.state !== 'CONNECTED') {
      throw new CameraError(
        'Cannot capture: Phone camera is not connected.',
        'CAMERA_NOT_CONNECTED',
        this.type
      );
    }

    const videoTrack = this.activeStream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new CameraError(
        'Cannot capture: No active video track found.',
        'TRACK_NOT_FOUND',
        this.type
      );
    }

    // Capture using off-screen video element
    const video = document.createElement('video');
    video.srcObject = this.activeStream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new CameraError(
        'Failed to allocate canvas 2D render context.',
        'CANVAS_ERROR',
        this.type
      );
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.pause();
    video.srcObject = null;

    return new Promise<CameraCaptureResult>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new CameraError(
                'Failed to encode camera photo blob.',
                'ENCODE_FAILED',
                this.type
              )
            );
            return;
          }
          const url = URL.createObjectURL(blob);
          resolve({
            blob,
            url,
            timestamp: Date.now(),
            metadata: {
              width: canvas.width,
              height: canvas.height,
              imu: this.currentOrientation
            }
          });
        },
        'image/jpeg',
        0.92
      );
    });
  }

  public async listMedia(): Promise<CameraMedia[]> {
    // Phone camera writes directly to app blob storage, not onboard camera SD card
    return [];
  }

  public async downloadMedia(_mediaId: string): Promise<Blob> {
    throw new CameraError(
      'Media download not supported for PhoneCameraProvider. Photos are stored locally.',
      'UNSUPPORTED_OPERATION',
      this.type
    );
  }

  public async deleteMedia(_mediaId: string): Promise<boolean> {
    return false;
  }

  public async getIMUData(): Promise<IMUData | null> {
    return this.currentOrientation;
  }

  public async getBatteryLevel(): Promise<BatteryStatus | null> {
    // Never fake hardware battery; phone camera has no dedicated battery reporting
    return null;
  }

  public async getStorageStatus(): Promise<StorageStatus | null> {
    // Never fake storage; browser does not have direct camera SD card access
    return null;
  }

  // =========================================================================
  // HDR & AEB CAPABILITIES & IMPLEMENTATION
  // =========================================================================

  public getHDRCapabilities(): HDRCapabilities {
    // Standard mobile browser getUserMedia supports standard JPEG single-frame capture,
    // but not professional multi-frame exposure bracketing (AEB).
    return {
      hdrSupported: false,
      aebSupported: false,
      supportedAebFrameCounts: [],
      supportedExposureSteps: [],
      rawSupported: false,
      jpegSupported: true,
      cameraSideHdrSupported: false,
      bracketedFramesAvailable: false,
      hdrMergeSupported: false
    };
  }

  public validateHDRConfig(config: HDRCaptureConfig): HDRValidationResult {
    return validateHDRConfigAgainstCapabilities(
      config,
      this.getHDRCapabilities(),
      this.state === 'CONNECTED',
      true
    );
  }

  public async captureHDR(config: HDRCaptureConfig): Promise<HDRCaptureResult> {
    const validation = this.validateHDRConfig(config);
    if (!validation.isValid) {
      const firstIssue = validation.issues[0];
      throw new CameraError(
        firstIssue?.message || 'Unsupported HDR configuration.',
        firstIssue?.code || 'INVALID_HDR_CONFIG',
        this.type
      );
    }

    if (config.mode === 'NORMAL') {
      const single = await this.capture();
      return {
        status: 'COMPLETED',
        mode: 'NORMAL',
        mergeMode: 'CAMERA',
        bracketFrames: [
          {
            frameIndex: 0,
            evOffset: 0,
            blob: single.blob,
            url: single.url,
            timestamp: single.timestamp
          }
        ],
        downloadedMediaReferences: [],
        processingStatus: 'READY'
      };
    }

    throw new CameraError(
      'AEB multi-exposure bracketing is not supported by standard mobile browser camera.',
      'AEB_NOT_SUPPORTED',
      this.type
    );
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

  private initOrientationListener(): void {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      return;
    }

    this.orientationListener = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        this.currentOrientation = {
          roll: Math.round(e.gamma),
          pitch: Math.round(e.beta),
          yaw: e.alpha !== null ? Math.round(e.alpha) : undefined
        };
      }
    };

    window.addEventListener('deviceorientation', this.orientationListener, true);
  }

  private removeOrientationListener(): void {
    if (this.orientationListener && typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', this.orientationListener, true);
      this.orientationListener = null;
    }
    this.currentOrientation = null;
  }
}
