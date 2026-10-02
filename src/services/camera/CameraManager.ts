import { CameraProvider } from './CameraProvider';
import {
  CameraCapabilities,
  CameraConnectionState,
  CameraError
} from './CameraCapabilities';
import {
  HDRCapabilities,
  HDRCaptureConfig,
  HDRCaptureResult,
  HDRValidationResult,
  AEBFrameCount
} from './HDRCapabilities';
import { HDRCapturePipeline, hdrCapturePipeline } from './HDRPipeline';
import { PhoneCameraProvider } from './PhoneCameraProvider';
import { Insta360Provider } from './Insta360Provider';
import { GoProProvider } from './GoProProvider';

/**
 * CameraManager
 * Registry and orchestrator for internal and external camera hardware providers.
 *
 * Responsibilities:
 * - Register internal and vendor camera providers
 * - Discover hardware availability
 * - Manage active provider selection and lifecycle
 * - Expose capabilities and connection states to UI components
 * - Expose HDR and AEB bracketing capabilities for the active camera
 * - Safely validate requested HDR configurations against hardware limits
 * - Safely intercept and log provider errors
 */
export class CameraManager {
  private providers: Map<string, CameraProvider> = new Map();
  private activeProviderId: string | null = null;
  private lastError: CameraError | null = null;

  constructor() {
    // Register standard providers
    this.registerProvider(new PhoneCameraProvider());
    this.registerProvider(new Insta360Provider());
    this.registerProvider(new GoProProvider());
  }

  /**
   * Register a new or custom camera provider adapter.
   */
  public registerProvider(provider: CameraProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Retrieve all registered providers.
   */
  public getProviders(): CameraProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Look up a provider by unique ID.
   */
  public getProvider(id: string): CameraProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get the currently active/selected camera provider.
   */
  public getActiveProvider(): CameraProvider | null {
    if (!this.activeProviderId) return null;
    return this.providers.get(this.activeProviderId) || null;
  }

  /**
   * Probe and return all providers that pass discovery checks.
   */
  public async discoverAvailableProviders(): Promise<CameraProvider[]> {
    const available: CameraProvider[] = [];
    for (const provider of this.providers.values()) {
      try {
        const isAvailable = await provider.discover();
        if (isAvailable) {
          available.push(provider);
        }
      } catch (err) {
        console.warn(`Discovery failed for provider ${provider.id}:`, err);
      }
    }
    return available;
  }

  /**
   * Select a provider by ID and establish connection.
   */
  public async selectProvider(id: string): Promise<boolean> {
    const provider = this.providers.get(id);
    if (!provider) {
      this.lastError = new CameraError(
        `Camera provider not registered: ${id}`,
        'PROVIDER_NOT_FOUND',
        'EXTERNAL_GENERIC'
      );
      return false;
    }

    // Safely disconnect currently active provider if changing
    if (this.activeProviderId && this.activeProviderId !== id) {
      const current = this.providers.get(this.activeProviderId);
      if (current) {
        try {
          await current.disconnect();
        } catch (err) {
          console.warn(`Error disconnecting previous provider ${current.id}:`, err);
        }
      }
    }

    try {
      const connected = await provider.connect();
      if (connected) {
        this.activeProviderId = id;
        this.lastError = null;
        return true;
      } else {
        const status = provider.getStatus();
        this.lastError = new CameraError(
          status.errorMessage || `Failed to connect to ${provider.name}.`,
          status.state,
          provider.type
        );
        return false;
      }
    } catch (err: any) {
      this.lastError =
        err instanceof CameraError
          ? err
          : new CameraError(err?.message || 'Connection failed', 'CONNECT_ERROR', provider.type);
      return false;
    }
  }

  /**
   * Alias for selectProvider to support existing call sites.
   */
  public async setActiveProvider(id: string): Promise<boolean> {
    return this.selectProvider(id);
  }

  /**
   * Connect to the currently selected active provider.
   */
  public async connectActiveProvider(): Promise<boolean> {
    if (!this.activeProviderId) {
      return false;
    }
    return this.selectProvider(this.activeProviderId);
  }

  /**
   * Safely terminate active provider session.
   */
  public async disconnectActive(): Promise<void> {
    if (this.activeProviderId) {
      const provider = this.providers.get(this.activeProviderId);
      if (provider) {
        try {
          await provider.disconnect();
        } catch (err) {
          console.warn(`Error disconnecting active provider ${provider.id}:`, err);
        }
      }
      this.activeProviderId = null;
    }
  }

  /**
   * Expose capability flags of the active provider to drive UI rules.
   */
  public getActiveCapabilities(): CameraCapabilities | null {
    const active = this.getActiveProvider();
    return active ? active.getCapabilities() : null;
  }

  /**
   * Expose current connection state of the active provider.
   */
  public getActiveConnectionState(): CameraConnectionState {
    const active = this.getActiveProvider();
    return active ? active.getConnectionState() : 'DISCONNECTED';
  }

  // =========================================================================
  // HDR & AEB CAPABILITIES & ORCHESTRATION
  // =========================================================================

  /**
   * Get HDR/AEB capability matrix of the currently connected provider.
   * Returns null if no camera is active.
   */
  public getActiveHDRCapabilities(): HDRCapabilities | null {
    const active = this.getActiveProvider();
    return active ? active.getHDRCapabilities() : null;
  }

  /**
   * Get supported AEB bracket frame counts for the active camera (e.g. [3, 5]).
   */
  public getSupportedAebFrameCounts(): readonly AEBFrameCount[] {
    const caps = this.getActiveHDRCapabilities();
    return caps ? caps.supportedAebFrameCounts : [];
  }

  /**
   * Get supported exposure steps in EV (e.g. [0.5, 1.0, 2.0]).
   */
  public getSupportedExposureSteps(): readonly number[] {
    const caps = this.getActiveHDRCapabilities();
    return caps ? caps.supportedExposureSteps : [];
  }

  /**
   * Check if RAW / DNG output format is supported.
   */
  public isRawSupported(): boolean {
    const caps = this.getActiveHDRCapabilities();
    return caps ? caps.rawSupported : false;
  }

  /**
   * Check if JPEG output format is supported.
   */
  public isJpegSupported(): boolean {
    const caps = this.getActiveHDRCapabilities();
    return caps ? caps.jpegSupported : false;
  }

  /**
   * Check if onboard camera-side HDR merge is supported.
   */
  public isCameraSideHdrSupported(): boolean {
    const caps = this.getActiveHDRCapabilities();
    return caps ? caps.cameraSideHdrSupported : false;
  }

  /**
   * Validate requested HDR configuration against the active camera.
   */
  public validateHDRConfig(config: HDRCaptureConfig): HDRValidationResult {
    const active = this.getActiveProvider();
    if (!active) {
      return {
        isValid: false,
        issues: [
          {
            code: 'PROVIDER_NOT_CONNECTED',
            message: 'No active camera provider connected to validate HDR config.'
          }
        ]
      };
    }
    return active.validateHDRConfig(config);
  }

  /**
   * Execute an HDR or AEB capture through the active provider.
   */
  public async captureHDR(config: HDRCaptureConfig): Promise<HDRCaptureResult> {
    const active = this.getActiveProvider();
    if (!active) {
      throw new CameraError(
        'Cannot capture HDR: No camera provider connected.',
        'PROVIDER_NOT_CONNECTED',
        'EXTERNAL_GENERIC'
      );
    }
    return active.captureHDR(config);
  }

  public getPipeline(): HDRCapturePipeline {
    return hdrCapturePipeline;
  }

  /**
   * Expose the last captured camera error.
   */
  public getLastError(): CameraError | null {
    return this.lastError;
  }

  /**
   * Clear error state.
   */
  public clearError(): void {
    this.lastError = null;
  }
}

// Export singleton instance
export const cameraManager = new CameraManager();
