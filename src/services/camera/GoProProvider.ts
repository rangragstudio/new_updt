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
 * GoPro Camera Provider Architecture
 * ============================================================================
 *
 * FUTURE DEVELOPER INTEGRATION GUIDE:
 * -----------------------------------
 * This provider serves as the integration boundary for GoPro MAX 360 and
 * HERO series cameras using the official Open GoPro API v2.0 specification.
 *
 * Future API integration points:
 * 1. BLUETOOTH LOW ENERGY (BLE) CONTROL:
 *    - Service UUID: 0000fea6-0000-1000-8000-00805f9b34fb
 *    - Characteristics:
 *      - Command Request: b5f20002-3850-45ce-83f7-900c27b728d8
 *      - Command Response: b5f20003-3850-45ce-83f7-900c27b728d8
 *    - Action: Send command 0x03 0x17 0x01 (Enable Wi-Fi AP) to retrieve
 *      the camera's local Wi-Fi SSID and WPA password.
 *
 * 2. HTTP REST CONTROL OVER WI-FI:
 *    - Endpoint: http://10.5.5.9:8080/gopro/
 *    - Shutter: GET /gopro/camera/shutter/start -> triggers 360 photo
 *    - Shutter Stop: GET /gopro/camera/shutter/stop
 *    - Media List: GET /gopro/media/list -> returns all captures on SD card
 *    - Media Download: GET /gopro/media/render?path=100GOPRO/GS__0001.JPG
 *
 * 3. HDR & AEB BRACKETING INTEGRATION:
 *    - GoPro MAX 360 supports standard Photo, PowerPano, and Burst/Multi-shot:
 *      GET /gopro/camera/presets/set_group?id=1001 (Photo Group)
 *      GET /gopro/camera/setting?setting=19&opt={EV_COMP}
 *    - For AEB Sequences:
 *      The Open GoPro API orchestrates rapid sequential captures stepping through
 *      exposure values: e.g. -2.0, 0.0, +2.0 EV.
 *    - Workflow A (CAMERA SuperPhoto / Onboard HDR):
 *      GET /gopro/camera/setting?setting=108&opt=1 (HDR mode enabled)
 *    - Workflow B (RENDERWALK Multi-bracket Merge):
 *      Raw .GPR / .JPG frames fetched from /gopro/media/list for RenderWalk merge.
 *
 * 4. LIVE PREVIEW:
 *    - GET /gopro/camera/stream/start -> streams UDP/RTP live video
 *      to udp://10.5.5.9:8554 (or MPEG-TS via HLS stream).
 *
 * 5. TELEMETRY & HARDWARE STATUS:
 *    - GET /gopro/camera/state -> returns real battery level, SD card free KB,
 *      internal camera temperature, and orientation settings.
 *
 * Current State:
 * The Open GoPro API adapter is NOT configured in this web applet.
 * Status strictly returns 'GOPRO_SDK_NOT_CONFIGURED'.
 * ZERO fake hardware connections, synthetic battery, or mock previews exist.
 * ============================================================================
 */
export class GoProProvider implements CameraProvider {
  public readonly id = 'gopro';
  public readonly name = 'GoPro 360';
  public readonly type = 'GOPRO' as const;

  // Capabilities will be enabled when official Open GoPro API adapter is connected
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

  private state: CameraConnectionState = 'GOPRO_SDK_NOT_CONFIGURED';

  public getInfo(): CameraInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      model: 'GoPro MAX 360 (Open GoPro API Ready)',
      manufacturer: 'GoPro'
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
      errorMessage: 'GoPro Open GoPro API/SDK adapter is not configured in this build.'
    };
  }

  public async discover(): Promise<boolean> {
    console.info(
      '[GoProProvider] Discovery requires Open GoPro BLE/Wi-Fi adapter. No fake hardware discovery.'
    );
    this.state = 'GOPRO_SDK_NOT_CONFIGURED';
    return false;
  }

  public async connect(): Promise<boolean> {
    console.warn(
      '[GoProProvider] Connection aborted: GoPro Open GoPro API is not configured.'
    );
    this.state = 'GOPRO_SDK_NOT_CONFIGURED';
    return false;
  }

  public async disconnect(): Promise<void> {
    this.state = 'GOPRO_SDK_NOT_CONFIGURED';
  }

  public async startPreview(): Promise<MediaStream | null> {
    return null;
  }

  public async stopPreview(): Promise<void> {
    // No-op until API adapter is linked
  }

  public async capture(): Promise<CameraCaptureResult> {
    throw new CameraError(
      'GoPro capture unavailable: GOPRO_SDK_NOT_CONFIGURED. Open GoPro API must be integrated.',
      'GOPRO_SDK_NOT_CONFIGURED',
      this.type
    );
  }

  public async listMedia(): Promise<CameraMedia[]> {
    return [];
  }

  public async downloadMedia(_mediaId: string): Promise<Blob> {
    throw new CameraError(
      'GoPro media download unavailable: GOPRO_SDK_NOT_CONFIGURED.',
      'GOPRO_SDK_NOT_CONFIGURED',
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
    // Until official Open GoPro API adapter is linked and configured,
    // all HDR/AEB capability flags remain false (zero fake capabilities).
    return DEFAULT_UNSUPPORTED_HDR_CAPABILITIES;
  }

  public validateHDRConfig(config: HDRCaptureConfig): HDRValidationResult {
    return validateHDRConfigAgainstCapabilities(
      config,
      this.getHDRCapabilities(),
      false, // Not connected
      false  // API not configured
    );
  }

  public async captureHDR(_config: HDRCaptureConfig): Promise<HDRCaptureResult> {
    throw new CameraError(
      'GoPro HDR capture unavailable: GOPRO_SDK_NOT_CONFIGURED. Open GoPro API must be integrated.',
      'GOPRO_SDK_NOT_CONFIGURED',
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
