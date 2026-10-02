/**
 * HDR & AEB Capture Capabilities & Types
 * Defines data structures and validation contracts for professional 360° HDR
 * and Auto-Exposure Bracketing (AEB) captures across internal and external camera providers.
 */

// Supported AEB frame counts across commercial 360 cameras
export type AEBFrameCount = 3 | 5 | 7 | 9;

// Primary capture modes
export type HDRCaptureMode = 'NORMAL' | 'AEB' | 'HDR';

// Supported output formats for bracketed frames
export type HDROutputFormat = 'JPEG' | 'RAW' | 'DNG';

// Workflow A: CAMERA (camera-side onboard merge) vs. Workflow B: RENDERWALK (downstream multi-frame bracket merge)
export type HDRMergeMode = 'CAMERA' | 'RENDERWALK';

/**
 * HDRCapabilities
 * Explicitly declares which HDR and AEB modes the connected camera hardware natively supports.
 */
export interface HDRCapabilities {
  readonly hdrSupported: boolean;
  readonly aebSupported: boolean;
  readonly supportedAebFrameCounts: readonly AEBFrameCount[];
  readonly supportedExposureSteps: readonly number[]; // e.g. [0.5, 1.0, 1.5, 2.0]
  readonly rawSupported: boolean;
  readonly jpegSupported: boolean;
  readonly cameraSideHdrSupported: boolean;
  readonly bracketedFramesAvailable: boolean;
  readonly hdrMergeSupported: boolean;
}

/**
 * Default empty/unsupported capabilities when a provider does not support HDR or is disconnected.
 */
export const DEFAULT_UNSUPPORTED_HDR_CAPABILITIES: HDRCapabilities = {
  hdrSupported: false,
  aebSupported: false,
  supportedAebFrameCounts: [],
  supportedExposureSteps: [],
  rawSupported: false,
  jpegSupported: false,
  cameraSideHdrSupported: false,
  bracketedFramesAvailable: false,
  hdrMergeSupported: false
};

/**
 * HDRCaptureConfig
 * Configuration parameters requested for an HDR or AEB capture session.
 */
export interface HDRCaptureConfig {
  readonly mode: HDRCaptureMode;
  readonly frameCount?: AEBFrameCount;
  readonly exposureStep?: number;
  readonly outputFormat: HDROutputFormat;
  readonly mergeMode: HDRMergeMode;
}

/**
 * HDRBracketFrame
 * Represents an individual exposure bracketed frame (e.g. -2EV, 0EV, +2EV).
 */
export interface HDRBracketFrame {
  readonly frameIndex: number;
  readonly evOffset: number; // EV deviation from meter baseline
  readonly blob?: Blob;
  readonly url?: string;
  readonly mediaId?: string;
  readonly timestamp: number;
}

/**
 * HDRCaptureResult
 * Comprehensive structure representing started, bracketed, or completed HDR capture states.
 */
export interface HDRCaptureResult {
  readonly status: 'CAPTURE_STARTED' | 'CAPTURING' | 'COMPLETED' | 'FAILED';
  readonly mode: HDRCaptureMode;
  readonly mergeMode: HDRMergeMode;
  readonly bracketFrames: readonly HDRBracketFrame[];
  readonly cameraSideHdrResult?: {
    readonly blob?: Blob;
    readonly url?: string;
    readonly mediaId?: string;
    readonly timestamp: number;
  };
  readonly downloadedMediaReferences: readonly string[];
  readonly processingStatus: 'PENDING' | 'MERGING' | 'READY' | 'UNPROCESSED';
  readonly error?: string;
}

/**
 * Validation issue error codes
 */
export type HDRValidationErrorCode =
  | 'HDR_NOT_SUPPORTED'
  | 'AEB_NOT_SUPPORTED'
  | 'UNSUPPORTED_FRAME_COUNT'
  | 'UNSUPPORTED_EXPOSURE_STEP'
  | 'UNSUPPORTED_OUTPUT_FORMAT'
  | 'UNSUPPORTED_MERGE_MODE'
  | 'PROVIDER_NOT_CONNECTED'
  | 'SDK_NOT_CONFIGURED';

export interface HDRValidationIssue {
  readonly code: HDRValidationErrorCode;
  readonly message: string;
}

export interface HDRValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly HDRValidationIssue[];
}

/**
 * Helper to validate an HDRCaptureConfig against a provider's HDRCapabilities
 * and current connection state.
 */
export function validateHDRConfigAgainstCapabilities(
  config: HDRCaptureConfig,
  capabilities: HDRCapabilities,
  isConnected: boolean,
  sdkConfigured = true
): HDRValidationResult {
  const issues: HDRValidationIssue[] = [];

  if (!sdkConfigured) {
    issues.push({
      code: 'SDK_NOT_CONFIGURED',
      message: 'Camera SDK/API is not configured in this environment.'
    });
    return { isValid: false, issues };
  }

  if (!isConnected) {
    issues.push({
      code: 'PROVIDER_NOT_CONNECTED',
      message: 'Camera provider is not connected.'
    });
    return { isValid: false, issues };
  }

  // 1. Mode validation
  if (config.mode === 'HDR' && !capabilities.hdrSupported) {
    issues.push({
      code: 'HDR_NOT_SUPPORTED',
      message: 'Single-shot HDR is not supported by the connected camera.'
    });
  }

  if (config.mode === 'AEB') {
    if (!capabilities.aebSupported) {
      issues.push({
        code: 'AEB_NOT_SUPPORTED',
        message: 'Auto-Exposure Bracketing (AEB) is not supported by the connected camera.'
      });
    }

    // Frame count check
    if (config.frameCount) {
      if (!capabilities.supportedAebFrameCounts.includes(config.frameCount)) {
        issues.push({
          code: 'UNSUPPORTED_FRAME_COUNT',
          message: `Bracket frame count ${config.frameCount} is not supported. Supported counts: [${capabilities.supportedAebFrameCounts.join(
            ', '
          )}].`
        });
      }
    } else {
      issues.push({
        code: 'UNSUPPORTED_FRAME_COUNT',
        message: 'AEB capture mode requires an explicit frame count (3, 5, 7, or 9).'
      });
    }

    // Exposure step check
    if (config.exposureStep !== undefined) {
      if (!capabilities.supportedExposureSteps.includes(config.exposureStep)) {
        issues.push({
          code: 'UNSUPPORTED_EXPOSURE_STEP',
          message: `Exposure step ${config.exposureStep} EV is not supported. Supported steps: [${capabilities.supportedExposureSteps.join(
            ', '
          )}].`
        });
      }
    }
  }

  // 2. Output format validation
  if (config.outputFormat === 'RAW' || config.outputFormat === 'DNG') {
    if (!capabilities.rawSupported) {
      issues.push({
        code: 'UNSUPPORTED_OUTPUT_FORMAT',
        message: `RAW/DNG output format is not supported by the connected camera.`
      });
    }
  } else if (config.outputFormat === 'JPEG') {
    if (!capabilities.jpegSupported) {
      issues.push({
        code: 'UNSUPPORTED_OUTPUT_FORMAT',
        message: `JPEG output format is not supported by the connected camera.`
      });
    }
  }

  // 3. Merge mode validation
  if (config.mergeMode === 'CAMERA' && !capabilities.cameraSideHdrSupported) {
    issues.push({
      code: 'UNSUPPORTED_MERGE_MODE',
      message: 'Onboard camera-side HDR merge is not supported. Use RENDERWALK bracketed merge.'
    });
  }

  if (config.mergeMode === 'RENDERWALK' && config.mode === 'AEB' && !capabilities.bracketedFramesAvailable) {
    issues.push({
      code: 'UNSUPPORTED_MERGE_MODE',
      message: 'Individual bracketed frames cannot be retrieved from this camera.'
    });
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}
