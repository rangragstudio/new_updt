/**
 * ============================================================================
 * Insta360 Native Integration Bridge
 * ============================================================================
 *
 * Implements the native bridge boundary decoupling the RenderWalk React Web UI
 * from platform-specific native Insta360 SDK binaries (C++/Android/iOS) or
 * local OSC / BLE proxy services.
 *
 * Architecture:
 * RenderWalk Web UI
 *         ↓
 * Camera Integration Bridge (Insta360NativeBridge)
 *         ↓
 * Native Insta360 SDK / Local OSC Daemon
 *         ↓
 * Physical Insta360 Camera
 *
 * SDK Availability Check:
 * If the native SDK bridge is not configured in the host environment, the bridge
 * remains strictly in 'SDK_NOT_CONFIGURED' state.
 * No fake hardware, mock connections, or synthetic battery levels are returned.
 * ============================================================================
 */

import {
  Insta360CameraError,
  Insta360DeviceDescriptor,
  Insta360DeviceCapabilities,
  Insta360CameraState,
  Insta360CaptureOptions,
  Insta360CaptureResult,
  Insta360FileInfo
} from './Insta360Types';

export interface IInsta360NativeBridge {
  readonly bridgeVersion: string;
  isSdkConfigured(): boolean;
  getMissingPrerequisites(): readonly string[];
  discoverCamera(): Promise<Insta360DeviceDescriptor | null>;
  connect(deviceId: string): Promise<boolean>;
  disconnect(): Promise<void>;
  getConnectionStatus(): 'CONNECTED' | 'DISCONNECTED' | 'SDK_NOT_CONFIGURED';
  getCameraState(): Promise<Insta360CameraState>;
  getCapabilities(): Promise<Insta360DeviceCapabilities>;
  setCaptureOptions(options: Insta360CaptureOptions): Promise<void>;
  capture(options: Insta360CaptureOptions): Promise<Insta360CaptureResult>;
  listFiles(params?: { offset?: number; count?: number }): Promise<readonly Insta360FileInfo[]>;
  downloadFile(fileUrl: string, onProgress?: (percent: number) => void): Promise<Blob>;
  deleteFile(fileUrl: string): Promise<boolean>;
  getLivePreviewStream(): Promise<MediaStream | null>;
}

/**
 * Standard implementation of the Native Integration Bridge.
 * Checks host environment (Window IPC / Local Daemon / OSC gateway).
 */
export class Insta360NativeBridge implements IInsta360NativeBridge {
  public readonly bridgeVersion = '1.0.0-native-bridge';
  private connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'SDK_NOT_CONFIGURED' = 'SDK_NOT_CONFIGURED';
  private activeDevice: Insta360DeviceDescriptor | null = null;
  private bridgeEndpoint: string | null = null;

  constructor(customEndpoint?: string) {
    // Check if host environment defines a bridge endpoint or native window bridge
    const envEndpoint =
      typeof process !== 'undefined' && process.env?.INSTA360_BRIDGE_URL
        ? process.env.INSTA360_BRIDGE_URL
        : null;

    const windowBridge =
      typeof window !== 'undefined' && (window as any).__INSTA360_NATIVE_BRIDGE__
        ? (window as any).__INSTA360_NATIVE_BRIDGE__
        : null;

    if (customEndpoint) {
      this.bridgeEndpoint = customEndpoint;
    } else if (envEndpoint) {
      this.bridgeEndpoint = envEndpoint;
    } else if (windowBridge) {
      this.bridgeEndpoint = 'window.__INSTA360_NATIVE_BRIDGE__';
    } else {
      this.bridgeEndpoint = null;
    }
  }

  /**
   * Evaluates if the official Insta360 native SDK / daemon is present and configured.
   */
  public isSdkConfigured(): boolean {
    return this.bridgeEndpoint !== null;
  }

  /**
   * Reports exactly what components are missing for the native bridge.
   */
  public getMissingPrerequisites(): readonly string[] {
    const missing: string[] = [];
    if (!this.bridgeEndpoint) {
      missing.push('Insta360 native CameraSDK binaries / local daemon not found in environment');
      missing.push('Environment variable INSTA360_BRIDGE_URL or window.__INSTA360_NATIVE_BRIDGE__ is not configured');
      missing.push('Physical Insta360 Wi-Fi SoftAP / BLE gateway not reachable from current PC host');
    }
    return missing;
  }

  public getConnectionStatus(): 'CONNECTED' | 'DISCONNECTED' | 'SDK_NOT_CONFIGURED' {
    if (!this.isSdkConfigured()) {
      return 'SDK_NOT_CONFIGURED';
    }
    return this.connectionStatus;
  }

  public async discoverCamera(): Promise<Insta360DeviceDescriptor | null> {
    if (!this.isSdkConfigured()) {
      return null;
    }

    try {
      // In a configured native environment, queries the bridge daemon:
      // GET /api/insta360/discover
      const res = await fetch(`${this.bridgeEndpoint}/discover`);
      if (!res.ok) return null;
      const device: Insta360DeviceDescriptor = await res.json();
      return device;
    } catch {
      return null;
    }
  }

  public async connect(deviceId: string): Promise<boolean> {
    if (!this.isSdkConfigured()) {
      this.connectionStatus = 'SDK_NOT_CONFIGURED';
      throw new Insta360CameraError(
        'Cannot connect: Insta360 native SDK is not configured in this environment.',
        'SDK_NOT_CONFIGURED'
      );
    }

    try {
      const res = await fetch(`${this.bridgeEndpoint}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });
      if (res.ok) {
        this.connectionStatus = 'CONNECTED';
        return true;
      }
      this.connectionStatus = 'DISCONNECTED';
      return false;
    } catch (err: any) {
      this.connectionStatus = 'DISCONNECTED';
      throw new Insta360CameraError(
        `Failed to connect to Insta360 camera: ${err?.message || 'Network error'}`,
        'CAMERA_DISCONNECTED'
      );
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isSdkConfigured()) {
      this.connectionStatus = 'SDK_NOT_CONFIGURED';
      return;
    }

    try {
      await fetch(`${this.bridgeEndpoint}/disconnect`, { method: 'POST' });
    } finally {
      this.connectionStatus = 'DISCONNECTED';
      this.activeDevice = null;
    }
  }

  public async getCameraState(): Promise<Insta360CameraState> {
    if (!this.isSdkConfigured() || this.connectionStatus !== 'CONNECTED') {
      return {
        batteryLevelPercent: null,
        isBatteryCharging: null,
        storageRemainingBytes: null,
        storageTotalBytes: null,
        isSdCardMounted: false,
        currentMode: 'error'
      };
    }

    const res = await fetch(`${this.bridgeEndpoint}/state`);
    if (!res.ok) {
      throw new Insta360CameraError('Failed to read camera state.', 'CAMERA_DISCONNECTED');
    }
    return res.json();
  }

  public async getCapabilities(): Promise<Insta360DeviceCapabilities> {
    if (!this.isSdkConfigured() || this.connectionStatus !== 'CONNECTED') {
      throw new Insta360CameraError(
        'Cannot read capabilities: Camera is not connected or SDK is not configured.',
        this.isSdkConfigured() ? 'CAMERA_DISCONNECTED' : 'SDK_NOT_CONFIGURED'
      );
    }

    const res = await fetch(`${this.bridgeEndpoint}/capabilities`);
    if (!res.ok) {
      throw new Insta360CameraError('Failed to query camera capabilities.', 'CAMERA_DISCONNECTED');
    }
    return res.json();
  }

  public async setCaptureOptions(options: Insta360CaptureOptions): Promise<void> {
    if (!this.isSdkConfigured() || this.connectionStatus !== 'CONNECTED') {
      throw new Insta360CameraError(
        'Cannot set capture options: Camera is not connected.',
        'CAMERA_DISCONNECTED'
      );
    }

    const res = await fetch(`${this.bridgeEndpoint}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Insta360CameraError(
        errData.message || 'Failed to apply capture options.',
        errData.code || 'CAPTURE_FAILED'
      );
    }
  }

  public async capture(options: Insta360CaptureOptions): Promise<Insta360CaptureResult> {
    if (!this.isSdkConfigured() || this.connectionStatus !== 'CONNECTED') {
      throw new Insta360CameraError(
        'Capture failed: Camera is not connected or SDK is not configured.',
        this.isSdkConfigured() ? 'CAMERA_DISCONNECTED' : 'SDK_NOT_CONFIGURED'
      );
    }

    const res = await fetch(`${this.bridgeEndpoint}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Insta360CameraError(
        errData.message || 'Capture command failed on Insta360 camera.',
        errData.code || 'CAPTURE_FAILED'
      );
    }

    return res.json();
  }

  public async listFiles(params?: { offset?: number; count?: number }): Promise<readonly Insta360FileInfo[]> {
    if (!this.isSdkConfigured() || this.connectionStatus !== 'CONNECTED') {
      return [];
    }

    const query = new URLSearchParams();
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.count !== undefined) query.set('count', String(params.count));

    const res = await fetch(`${this.bridgeEndpoint}/files?${query.toString()}`);
    if (!res.ok) return [];
    return res.json();
  }

  public async downloadFile(fileUrl: string, onProgress?: (percent: number) => void): Promise<Blob> {
    if (!this.isSdkConfigured()) {
      throw new Insta360CameraError(
        'Media download unavailable: SDK not configured.',
        'SDK_NOT_CONFIGURED'
      );
    }

    const res = await fetch(fileUrl);
    if (!res.ok) {
      throw new Insta360CameraError(
        `Failed to download file from camera: HTTP ${res.status}`,
        'DOWNLOAD_FAILED'
      );
    }

    if (onProgress) onProgress(100);
    return res.blob();
  }

  public async deleteFile(fileUrl: string): Promise<boolean> {
    if (!this.isSdkConfigured()) return false;
    const res = await fetch(fileUrl, { method: 'DELETE' });
    return res.ok;
  }

  public async getLivePreviewStream(): Promise<MediaStream | null> {
    return null; // Preview requires native bridge RTSP/MJPEG decode stream
  }
}

// Global default bridge instance
export const insta360NativeBridge = new Insta360NativeBridge();
