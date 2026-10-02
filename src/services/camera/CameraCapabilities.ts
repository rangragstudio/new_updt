/**
 * Camera Capabilities & Architecture Types
 * Standardized data contracts, capability flags, and connection states
 * for RenderWalk camera hardware providers.
 */

// 1. CameraProviderType
export type CameraProviderType = 'PHONE' | 'INSTA360' | 'GOPRO' | 'EXTERNAL_GENERIC';

// 2. CameraConnectionState
export type CameraConnectionState =
  | 'DISCONNECTED'
  | 'DISCOVERING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'INSTA360_SDK_NOT_CONFIGURED'
  | 'GOPRO_SDK_NOT_CONFIGURED'
  | 'SDK_NOT_CONNECTED'
  | 'UNAVAILABLE'
  | 'ERROR';

// Standardized capability discovery states
export type CameraCapabilityState =
  | 'SDK_NOT_CONFIGURED'
  | 'SDK_READY'
  | 'CAMERA_DISCONNECTED'
  | 'CAMERA_CONNECTED'
  | 'CAPABILITIES_LOADING'
  | 'CAPABILITIES_READY'
  | 'UNSUPPORTED_CAMERA';

// For backward-compatibility aliases
export type CameraConnectionStatus = CameraConnectionState;

// 3. CameraCapability & CameraCapabilities
export type CameraCapability =
  | 'preview'
  | 'capture'
  | 'mediaDownload'
  | 'mediaDelete'
  | 'battery'
  | 'storage'
  | 'imu'
  | 'stitching';

export interface CameraCapabilities {
  readonly preview: boolean;
  readonly capture: boolean;
  readonly mediaDownload: boolean;
  readonly mediaDelete: boolean;
  readonly battery: boolean;
  readonly storage: boolean;
  readonly imu: boolean;
  readonly stitching: boolean;
}

// Battery & Storage
export interface BatteryStatus {
  readonly levelPercent: number; // 0 - 100
  readonly isCharging?: boolean;
}

export interface StorageStatus {
  readonly freeBytes: number;
  readonly totalBytes: number;
}

// Real IMU Angles
export interface IMUData {
  readonly roll: number;
  readonly pitch: number;
  readonly yaw?: number;
}

// 4. CameraStatus
export interface CameraStatus {
  readonly state: CameraConnectionState;
  readonly battery: BatteryStatus | null;
  readonly storage: StorageStatus | null;
  readonly firmwareVersion: string | null;
  readonly errorMessage: string | null;
  readonly isRecording?: boolean;
}

// 5. CameraMedia
export interface CameraMedia {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly mimeType: string;
  readonly thumbnailUrl?: string;
  readonly downloadUrl?: string;
}

// Backward-compatibility alias
export type CameraMediaItem = CameraMedia;

// 6. CameraCaptureResult
export interface CameraCaptureResult {
  readonly blob: Blob;
  readonly url: string;
  readonly timestamp: number;
  readonly metadata?: {
    readonly width?: number;
    readonly height?: number;
    readonly imu?: IMUData | null;
    readonly is360Equirectangular?: boolean;
  };
}

// 7. CameraError
export class CameraError extends Error {
  public readonly code: string;
  public readonly providerType: CameraProviderType;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    code: string,
    providerType: CameraProviderType,
    recoverable = false
  ) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
    this.providerType = providerType;
    this.recoverable = recoverable;
  }
}

// Camera Info
export interface CameraInfo {
  readonly id: string;
  readonly name: string;
  readonly type: CameraProviderType;
  readonly model?: string;
  readonly manufacturer?: string;
  readonly firmwareVersion?: string;
}
