/**
 * ============================================================================
 * Insta360 Camera Integration Types & Error Model
 * ============================================================================
 *
 * Modeled after the official Insta360 Camera SDK and Google Open Spherical
 * Camera (OSC) v2.x REST / BLE specifications for dual-lens 360° cameras:
 * - Insta360 X4 (8K 360, 5.7K HDR, AEB bracketing)
 * - Insta360 X3 (Active HDR, 5.7K 360, AEB 3/5/7/9)
 * - Insta360 ONE RS 1-Inch 360 (PureShot, Dual 1-inch sensors, RAW+JPEG bracketing)
 * - Insta360 ONE X2 (5.7K 360, HDR photo, AEB 3/5/7/9)
 * - Insta360 Sphere
 * ============================================================================
 */

export type Insta360ErrorCode =
  | 'CAMERA_NOT_FOUND'
  | 'CAMERA_DISCONNECTED'
  | 'SDK_NOT_CONFIGURED'
  | 'UNSUPPORTED_MODEL'
  | 'HDR_NOT_SUPPORTED'
  | 'AEB_NOT_SUPPORTED'
  | 'AEB_FRAME_COUNT_NOT_SUPPORTED'
  | 'EXPOSURE_STEP_NOT_SUPPORTED'
  | 'CAPTURE_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'STORAGE_FULL'
  | 'LOW_BATTERY';

export class Insta360CameraError extends Error {
  public readonly code: Insta360ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: Insta360ErrorCode, details?: Record<string, unknown>) {
    super(message);
    this.name = 'Insta360CameraError';
    this.code = code;
    this.details = details;
  }
}

export type Insta360Model =
  | 'Insta360 X4'
  | 'Insta360 X3'
  | 'Insta360 ONE RS 1-Inch 360'
  | 'Insta360 ONE RS'
  | 'Insta360 ONE X2'
  | 'Insta360 Sphere'
  | 'Unknown Insta360';

export interface Insta360DeviceDescriptor {
  readonly deviceId: string;
  readonly model: Insta360Model;
  readonly serialNumber: string;
  readonly firmwareVersion: string;
  readonly ipAddress?: string;
  readonly bleAddress?: string;
  readonly connectionType: 'WIFI_OSC' | 'BLE' | 'USB';
}

export interface Insta360DeviceCapabilities {
  readonly model: Insta360Model;
  readonly firmwareVersion: string;
  readonly isHDRSupported: boolean;
  readonly isCameraSideHDRSupported: boolean;
  readonly isAEBSupported: boolean;
  readonly supportedAEBFrameCounts: readonly (3 | 5 | 7 | 9)[];
  readonly supportedExposureSteps: readonly (0.5 | 1.0 | 1.5 | 2.0)[];
  readonly supportedFormats: readonly ('JPEG' | 'RAW' | 'RAW+JPEG' | 'INSP')[];
  readonly supportedResolutions: readonly {
    readonly width: number;
    readonly height: number;
    readonly name: string;
  }[];
  readonly isLivePreviewSupported: boolean;
}

export interface Insta360CameraState {
  readonly batteryLevelPercent: number | null; // 0-100 or null if unknown
  readonly isBatteryCharging: boolean | null;
  readonly storageRemainingBytes: number | null;
  readonly storageTotalBytes: number | null;
  readonly isSdCardMounted: boolean;
  readonly currentMode: 'idle' | 'recording' | 'capturing' | 'transferring' | 'error';
}

export interface Insta360BracketParams {
  readonly count: 3 | 5 | 7 | 9;
  readonly step: 0.5 | 1.0 | 1.5 | 2.0;
  readonly format: 'JPEG' | 'RAW' | 'RAW+JPEG' | 'INSP';
}

export interface Insta360CaptureOptions {
  readonly mode: 'normal' | 'hdr' | 'bracket';
  readonly bracketParams?: Insta360BracketParams;
  readonly resolution?: { readonly width: number; readonly height: number };
  readonly format?: 'JPEG' | 'RAW' | 'RAW+JPEG' | 'INSP';
}

export interface Insta360FileInfo {
  readonly fileId: string;
  readonly filename: string;
  readonly fileUrl: string;
  readonly sizeBytes: number;
  readonly createdAt: number;
  readonly mimeType: string;
  readonly evOffset?: number;
  readonly frameIndex?: number;
  readonly totalFramesInGroup?: number;
  readonly isHDRMerged?: boolean;
}

export interface Insta360CaptureResult {
  readonly captureGroupId: string;
  readonly isHDRMerged: boolean; // True if camera returned an onboard-merged single HDR
  readonly files: readonly Insta360FileInfo[];
  readonly cameraModel: Insta360Model;
  readonly timestamp: number;
}
