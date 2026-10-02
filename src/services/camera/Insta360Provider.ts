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
 * ============================================================================
 * Insta360 Camera Provider Architecture
 * ============================================================================
 *
 * FUTURE DEVELOPER INTEGRATION GUIDE:
 * -----------------------------------
 * This provider serves as the integration boundary for Insta360 dual-lens
 * 360° cameras (e.g. Insta360 X3, X4, ONE RS, ONE X2, Sphere).
 *
 * Future SDK integration points:
 * 1. DISCOVERY & PAIRING:
 *    - On Mobile (iOS/Android Native): Connect to Insta360 CameraSDK via
 *      Bluetooth Low Energy (BLE) peripheral advertisement (UUID: 0000ffe0...).
 *    - On Web/Desktop: Connect to camera via local Wi-Fi SoftAP (192.168.42.1)
 *      using the Google Open Spherical Camera (OSC) v2.x REST protocol:
 *      POST /osc/commands/execute -> camera.startSession
 *
 * 2. LIVE PREVIEW:
 *    - Connect to RTSP stream (rtsp://192.168.42.1/live/liveStream) or
 *      HTTP MJPEG stream (/osc/commands/execute -> camera.getLivePreview).
 *    - Decode stream into an HTMLMediaElement or WebGL canvas texture.
 *
 * 3. SHUTTER & 360° CAPTURE:
 *    - POST /osc/commands/execute -> camera.takePicture
 *    - Poll /osc/commands/status with the returned commandId until state is "done".
 *    - Retrieve equirectangular JPEG or raw .INSP dual-fisheye frames.
 *
 * 4. HDR & AEB BRACKETING INTEGRATION:
 *    - AEB Bracketing Configuration:
 *      POST /osc/commands/execute -> camera.setOptions
 *      options: {
 *        captureMode: "bracket",
 *        _bracketParameters: {
 *          count: 3 | 5 | 7 | 9,
 *          step: 0.5 | 1.0 | 1.5 | 2.0,
 *          format: "RAW+JPEG" | "RAW" | "JPEG"
 *        }
 *      }
 *    - Workflow A (CAMERA Merge):
 *      POST /osc/commands/execute -> camera.setOptions { "hdr": true }
 *      Camera generates merged 360 equirectangular JPEG onboard.
 *    - Workflow B (RENDERWALK Multi-frame Merge):
 *      Camera saves individual bracketed .INSP / .DNG files:
 *      e.g. IMG_0001_1.INSP (-2EV), IMG_0001_2.INSP (-1EV), IMG_0001_3.INSP (0EV)...
 *      Provider downloads each file for downstream RenderWalk 360 HDR pipeline.
 *
 * 5. ONBOARD STORAGE & TELEMETRY:
 *    - GET /osc/state -> returns real batteryLevel, storageChanged, _cameraType.
 *
 * Current State:
 * The official Insta360 SDK binaries/HTTP client are NOT configured in this web applet.
 * Status strictly returns 'INSTA360_SDK_NOT_CONFIGURED'.
 * ZERO fake hardware connections, synthetic battery, or mock previews exist.
 * ============================================================================
 */
export class Insta360Provider implements CameraProvider {
  public readonly id = 'insta360';
  public readonly name = 'Insta360 Camera';
  public readonly type = 'INSTA360' as const;

  // Capabilities will be enabled when official SDK adapter is connected
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

  private state: CameraConnectionState = 'INSTA360_SDK_NOT_CONFIGURED';

  public getInfo(): CameraInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      model: 'Insta360 X3 / X4 / ONE RS (Adapter Ready)',
      manufacturer: 'Insta360'
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
      battery: null,
      storage: null,
      firmwareVersion: null,
      errorMessage: 'Insta360 camera SDK/API adapter is not configured in this build.'
    };
  }

  public async discover(): Promise<boolean> {
    console.info(
      '[Insta360Provider] Hardware discovery requires official Insta360 SDK/OSC adapter. No fake discovery.'
    );
    this.state = 'INSTA360_SDK_NOT_CONFIGURED';
    return false;
  }

  public async connect(): Promise<boolean> {
    console.warn(
      '[Insta360Provider] Connection aborted: Insta360 SDK/OSC adapter is not configured.'
    );
    this.state = 'INSTA360_SDK_NOT_CONFIGURED';
    return false;
  }

  public async disconnect(): Promise<void> {
    this.state = 'INSTA360_SDK_NOT_CONFIGURED';
  }

  public async startPreview(): Promise<MediaStream | null> {
    return null;
  }

  public async stopPreview(): Promise<void> {
    // No-op until SDK adapter is linked
  }

  public async capture(): Promise<CameraCaptureResult> {
    throw new CameraError(
      'Insta360 capture unavailable: INSTA360_SDK_NOT_CONFIGURED. Official SDK must be integrated.',
      'INSTA360_SDK_NOT_CONFIGURED',
      this.type
    );
  }

  public async listMedia(): Promise<CameraMedia[]> {
    return [];
  }

  public async downloadMedia(_mediaId: string): Promise<Blob> {
    throw new CameraError(
      'Insta360 media download unavailable: INSTA360_SDK_NOT_CONFIGURED.',
      'INSTA360_SDK_NOT_CONFIGURED',
      this.type
    );
  }

  public async deleteMedia(_mediaId: string): Promise<boolean> {
    return false;
  }

  public async getIMUData(): Promise<IMUData | null> {
    return null;
  }

  public async getBatteryLevel(): Promise<BatteryStatus | null> {
    return null;
  }

  public async getStorageStatus(): Promise<StorageStatus | null> {
    return null;
  }

  // =========================================================================
  // HDR & AEB CAPABILITIES & IMPLEMENTATION
  // =========================================================================

  public getHDRCapabilities(): HDRCapabilities {
    // Until official Insta360 SDK adapter is linked and configured,
    // all HDR/AEB capability flags remain false (zero fake capabilities).
    return DEFAULT_UNSUPPORTED_HDR_CAPABILITIES;
  }

  public validateHDRConfig(config: HDRCaptureConfig): HDRValidationResult {
    return validateHDRConfigAgainstCapabilities(
      config,
      this.getHDRCapabilities(),
      false, // Not connected
      false  // SDK not configured
    );
  }

  public async captureHDR(_config: HDRCaptureConfig): Promise<HDRCaptureResult> {
    throw new CameraError(
      'Insta360 HDR capture unavailable: INSTA360_SDK_NOT_CONFIGURED. Official SDK must be integrated.',
      'INSTA360_SDK_NOT_CONFIGURED',
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
}
