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
  CameraProviderType
} from './CameraCapabilities';
import {
  HDRCapabilities,
  HDRCaptureConfig,
  HDRCaptureResult,
  HDRValidationResult
} from './HDRCapabilities';

export * from './CameraCapabilities';
export * from './HDRCapabilities';

/**
 * CameraProvider
 * Core abstraction contract for internal and external camera devices.
 * Every provider (Phone, Insta360, GoPro) strictly adheres to this contract.
 *
 * Rules:
 * 1. If a capability flag is false, the corresponding method must return null
 *    or throw a typed CameraError explaining the unsupported/unconfigured state.
 * 2. Never fabricate simulated hardware telemetry (battery, IMU, storage, preview).
 * 3. Never silently downgrade HDR/AEB settings; validate and reject unsupported configs.
 */
export interface CameraProvider {
  readonly id: string;
  readonly name: string;
  readonly type: CameraProviderType;
  readonly capabilities: CameraCapabilities;

  /** Camera hardware descriptor and vendor details */
  getInfo(): CameraInfo;

  /** Capability flags describing which features this provider natively supports */
  getCapabilities(): CameraCapabilities;

  /** Establish communication session with camera (Bluetooth/Wi-Fi/WebRTC/USB) */
  connect(): Promise<boolean>;

  /** Terminate session, stop streams, and release hardware/socket resources */
  disconnect(): Promise<void>;

  /** Check current connection state string */
  getConnectionState(): CameraConnectionState;

  /** Snapshot of current camera status (state, real battery, real storage) */
  getStatus(): CameraStatus;

  /** Start preview stream (WebRTC, MediaStream, or RTSP/WebSocket frame buffer) */
  startPreview(): Promise<MediaStream | null>;

  /** Stop preview stream and release video track */
  stopPreview(): Promise<void>;

  /** Trigger photo or single standard frame capture */
  capture(): Promise<CameraCaptureResult>;

  /** List media items on camera's onboard SD card / memory */
  listMedia(): Promise<CameraMedia[]>;

  /** Download high-resolution media file from camera storage */
  downloadMedia(mediaId: string): Promise<Blob>;

  /** Delete a media item from camera storage */
  deleteMedia(mediaId: string): Promise<boolean>;

  /** Read real orientation (roll/pitch/yaw) from onboard IMU sensors (null if unsupported) */
  getIMUData(): Promise<IMUData | null>;

  /** Read real battery level percentage from camera hardware (null if unsupported) */
  getBatteryLevel(): Promise<BatteryStatus | null>;

  /** Read real storage capacity from onboard memory card (null if unsupported) */
  getStorageStatus(): Promise<StorageStatus | null>;

  /** Discover hardware availability (probe BLE / USB / MediaDevices) */
  discover(): Promise<boolean>;

  // =========================================================================
  // HDR & AEB CAPABILITY ARCHITECTURE
  // =========================================================================

  /** Return the camera's native HDR and AEB bracketing capabilities */
  getHDRCapabilities(): HDRCapabilities;

  /** Validate requested HDR/AEB capture configuration against camera hardware constraints */
  validateHDRConfig(config: HDRCaptureConfig): HDRValidationResult;

  /** Execute HDR or bracketed AEB capture sequence */
  captureHDR(config: HDRCaptureConfig): Promise<HDRCaptureResult>;

  // --- Optional Legacy Compatibility Aliases ---
  getPreviewStream?(): Promise<MediaStream | null>;
  capturePhoto?(): Promise<CameraCaptureResult>;
  getOrientation?(): Promise<IMUData | null>;
  getBatteryStatus?(): Promise<BatteryStatus | null>;
}
