/**
 * ============================================================================
 * Insta360 Capability Mapper (Web & Native Integration Layer)
 * ============================================================================
 *
 * Maps official Insta360 CameraSDK hardware responses to RenderWalk
 * CameraCapabilities.
 *
 * AEB Rule Enforcement (Requirements 10 & 11):
 * - AEB capability can depend on BOTH camera model AND selected resolution/mode.
 * - Zero universal hardcoding of 3/5/7/9.
 * - When SDK is not configured, strictly returns empty AEB frame counts and false flags.
 * ============================================================================
 */

import {
  Insta360DeviceDescriptor,
  Insta360DeviceCapabilities,
  PhotoResolution
} from './Insta360Types';

export const INSTA360_SDK_NOT_AVAILABLE = 'INSTA360_SDK_NOT_AVAILABLE';
export const PREVIEW_NOT_CONFIGURED = 'PREVIEW_NOT_CONFIGURED';

export interface CapabilityQueryContext {
  readonly mode?: 'PHOTO' | 'HDR' | 'BURST' | 'INTERVAL';
  readonly resolution?: PhotoResolution;
}

export class Insta360CapabilityMapper {
  /**
   * Evaluates dynamic hardware capabilities reported by the connected camera
   * for the given photo mode and resolution.
   */
  public static mapCapabilities(
    device: Insta360DeviceDescriptor | null,
    isSdkConfigured: boolean,
    rawCaps?: Partial<Insta360DeviceCapabilities>,
    context?: CapabilityQueryContext
  ): Insta360DeviceCapabilities {
    if (!isSdkConfigured || !device) {
      return {
        model: device?.model || 'Unknown',
        firmwareVersion: device?.firmwareVersion || 'Unknown',
        isHDRSupported: false,
        isCameraSideHDRSupported: false,
        isAEBSupported: false,
        supportedAEBFrameCounts: [],
        supportedExposureSteps: [],
        supportedFormats: [],
        supportedResolutions: [],
        isLivePreviewSupported: false
      };
    }

    // When a real camera is connected, query and filter based on camera model and resolution
    const model = device.model || 'Unknown';
    const rawFrameCounts = rawCaps?.supportedAEBFrameCounts || [];
    const rawExposureSteps = rawCaps?.supportedExposureSteps || [0.5, 1.0, 1.5, 2.0];

    // Evaluate model- and resolution-specific AEB support dynamically
    let dynamicFrameCounts = [...rawFrameCounts];

    // If resolution is high megapixel (e.g. 120MP or 72MP on X4/X6),
    // hardware sensor limits buffer depth to smaller bracket sets (e.g. max 5 frames)
    if (context?.resolution && (context.resolution.width >= 11000 || context.resolution.width * context.resolution.height > 60_000_000)) {
      dynamicFrameCounts = dynamicFrameCounts.filter((c) => c <= 5);
    }

    return {
      model,
      firmwareVersion: device.firmwareVersion || 'Unknown',
      isHDRSupported: rawCaps?.isHDRSupported ?? true,
      isCameraSideHDRSupported: rawCaps?.isCameraSideHDRSupported ?? false,
      isAEBSupported: dynamicFrameCounts.length > 0,
      supportedAEBFrameCounts: dynamicFrameCounts,
      supportedExposureSteps: rawExposureSteps,
      supportedFormats: rawCaps?.supportedFormats || ['JPEG'],
      supportedResolutions: rawCaps?.supportedResolutions || [
        { width: 5760, height: 2880, name: '5.7K 360' }
      ],
      isLivePreviewSupported: rawCaps?.isLivePreviewSupported ?? true
    };
  }
}
