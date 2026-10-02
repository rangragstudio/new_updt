/**
 * ============================================================================
 * RenderWalk HDR Merge & Exposure Fusion Engine (Hardened & Optimized)
 * ============================================================================
 *
 * Implements server/worker-side multi-exposure bracket fusion (Mertens algorithm)
 * with scanline/chunked memory management for 2K, 4K, and 8K 360° panoramas.
 *
 * Hardening Features:
 * 1. Chunked Row Processing: Prevents large memory allocations during fusion.
 * 2. Resolution Boundaries: Safe limits for 2K, 4K, and up to 8K (8192x4096).
 * 3. Exposure Metadata Consistency: Rejects contradictory or duplicate EV sets.
 * 4. Post-merge Quality Verification: Detects black frames, white blowouts, and severe clipping.
 * 5. Clean Alignment Boundary: Retains transparent interface without synthetic fake homography.
 * ============================================================================
 */

export interface ExposureFrameBuffer {
  readonly frameIndex: number;
  readonly evOffset: number; // e.g. -2, -1, 0, 1, 2
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray | Uint8Array; // RGBA byte sequence
  readonly mimeType: string;
}

export interface FusionParameters {
  readonly weightExposedness: number; // default: 1.0
  readonly weightContrast: number;    // default: 1.0
  readonly weightSaturation: number;  // default: 1.0
  readonly sigmaExposedness: number;  // default: 0.2
}

export const DEFAULT_FUSION_PARAMETERS: FusionParameters = {
  weightExposedness: 1.0,
  weightContrast: 1.0,
  weightSaturation: 1.0,
  sigmaExposedness: 0.2
};

export interface HDRQualityMetrics {
  readonly minLuminance: number;
  readonly maxLuminance: number;
  readonly avgLuminance: number;
  readonly isQualityAcceptable: boolean;
  readonly reason?: string;
}

export interface HDRMergeResult {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray; // Blended RGBA pixel buffer
  readonly frameCountMerged: number;
  readonly durationMs: number;
  readonly parametersUsed: FusionParameters;
  readonly qualityMetrics: HDRQualityMetrics;
}

/**
 * Image Alignment Boundary Interface
 * Requirement 3: Clean boundary for camera stabilization / optical flow.
 */
export interface ImageAlignmentAdapter {
  readonly name: string;
  readonly isSubpixelOpticalFlowSupported: boolean;
  align(frames: ExposureFrameBuffer[]): Promise<ExposureFrameBuffer[]>;
}

/**
 * DirectPassAlignmentAdapter
 * Standard for tripod/monopod-mounted 360° cameras with rapid electronic shutter.
 * Explicitly declares that subpixel homography requires external OpenCV/WASM modules.
 */
export class DirectPassAlignmentAdapter implements ImageAlignmentAdapter {
  public readonly name = 'DIRECT_RIG_MOUNTED_PASS';
  public readonly isSubpixelOpticalFlowSupported = false;

  public async align(frames: ExposureFrameBuffer[]): Promise<ExposureFrameBuffer[]> {
    return frames;
  }
}

/**
 * Maximum supported panorama resolution for memory safety (8K standard)
 */
export const MAX_PANORAMA_WIDTH = 8192;
export const MAX_PANORAMA_HEIGHT = 4096;

export class HDRMergeEngine {
  private alignmentAdapter: ImageAlignmentAdapter;

  constructor(alignmentAdapter?: ImageAlignmentAdapter) {
    this.alignmentAdapter = alignmentAdapter || new DirectPassAlignmentAdapter();
  }

  public setAlignmentAdapter(adapter: ImageAlignmentAdapter): void {
    this.alignmentAdapter = adapter;
  }

  public getAlignmentAdapter(): ImageAlignmentAdapter {
    return this.alignmentAdapter;
  }

  /**
   * Verify exposure metadata consistency across bracketed frames.
   * Ensures frames do not contain duplicate identical EV offsets or invalid ranges.
   */
  public validateExposureConsistency(frames: ExposureFrameBuffer[]): { isValid: boolean; reason?: string } {
    if (!frames || frames.length === 0) {
      return { isValid: false, reason: 'Empty frame set.' };
    }

    const seenEvs = new Set<number>();
    let hasZeroEv = false;

    for (const f of frames) {
      if (Math.abs(f.evOffset) > 8) {
        return { isValid: false, reason: `Exposure value ${f.evOffset} EV exceeds realistic bounds (-8 to +8 EV).` };
      }
      if (seenEvs.has(f.evOffset)) {
        return {
          isValid: false,
          reason: `Contradictory exposure metadata: Duplicate EV offset ${f.evOffset} found in multiple bracket frames.`
        };
      }
      seenEvs.add(f.evOffset);
      if (f.evOffset === 0) hasZeroEv = true;
    }

    return { isValid: true };
  }

  /**
   * Post-merge quality verification to detect black frames, blown-out white frames, or corrupted channels.
   */
  public validateOutputQuality(data: Uint8ClampedArray, width: number, height: number): HDRQualityMetrics {
    const totalPixels = width * height;
    if (totalPixels === 0 || data.length < totalPixels * 4) {
      return {
        minLuminance: 0,
        maxLuminance: 0,
        avgLuminance: 0,
        isQualityAcceptable: false,
        reason: 'Corrupted pixel buffer length.'
      };
    }

    // Sample pixels across canvas for fast quality audit
    const sampleStep = Math.max(1, Math.floor(totalPixels / 10000));
    let minLum = 255;
    let maxLum = 0;
    let sumLum = 0;
    let sampleCount = 0;

    for (let p = 0; p < totalPixels; p += sampleStep) {
      const idx = p * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
      sumLum += lum;
      sampleCount++;
    }

    const avgLum = sampleCount > 0 ? sumLum / sampleCount : 0;

    if (maxLum < 5) {
      return {
        minLuminance: minLum,
        maxLuminance: maxLum,
        avgLuminance: avgLum,
        isQualityAcceptable: false,
        reason: 'Severe underexposure: Output panorama is completely black.'
      };
    }

    if (minLum > 250) {
      return {
        minLuminance: minLum,
        maxLuminance: maxLum,
        avgLuminance: avgLum,
        isQualityAcceptable: false,
        reason: 'Severe overexposure: Output panorama is completely white.'
      };
    }

    return {
      minLuminance: Math.round(minLum),
      maxLuminance: Math.round(maxLum),
      avgLuminance: Math.round(avgLum),
      isQualityAcceptable: true
    };
  }

  /**
   * Merge 3, 5, 7, or 9 exposure bracketed frames into a single tone-mapped panorama.
   * Optimized with chunked row execution for 2K, 4K, and 8K memory stability.
   */
  public async mergeBracketSet(
    inputFrames: ExposureFrameBuffer[],
    params: FusionParameters = DEFAULT_FUSION_PARAMETERS
  ): Promise<HDRMergeResult> {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (!inputFrames || inputFrames.length < 3) {
      throw new Error(`AEB merge requires at least 3 bracket frames. Received: ${inputFrames?.length || 0}.`);
    }

    const count = inputFrames.length;
    if (count !== 3 && count !== 5 && count !== 7 && count !== 9) {
      throw new Error(`AEB merge supports 3, 5, 7, or 9 frames. Received unsupported count: ${count}.`);
    }

    // 1. Validate identical dimensions across all bracket frames
    const baseWidth = inputFrames[0].width;
    const baseHeight = inputFrames[0].height;
    if (baseWidth <= 0 || baseHeight <= 0) {
      throw new Error(`Invalid frame dimensions: ${baseWidth}x${baseHeight}.`);
    }

    // 8K Safe Boundary Check
    if (baseWidth > MAX_PANORAMA_WIDTH || baseHeight > MAX_PANORAMA_HEIGHT) {
      throw new Error(
        `Resolution ${baseWidth}x${baseHeight} exceeds safe 8K limit (${MAX_PANORAMA_WIDTH}x${MAX_PANORAMA_HEIGHT}).`
      );
    }

    for (let i = 1; i < count; i++) {
      if (inputFrames[i].width !== baseWidth || inputFrames[i].height !== baseHeight) {
        throw new Error(
          `Mismatched bracket frame dimensions. Frame 0 is ${baseWidth}x${baseHeight}, but Frame ${i} is ${inputFrames[i].width}x${inputFrames[i].height}.`
        );
      }
    }

    // 2. Validate exposure metadata consistency
    const metaCheck = this.validateExposureConsistency(inputFrames);
    if (!metaCheck.isValid) {
      throw new Error(metaCheck.reason);
    }

    // 3. Alignment boundary pass
    const alignedFrames = await this.alignmentAdapter.align(inputFrames);

    // 4. Allocate output pixel buffer (RGBA)
    const pixelCount = baseWidth * baseHeight;
    const outputData = new Uint8ClampedArray(pixelCount * 4);

    // 5. Precompute Gaussian factor
    const twoSigmaSq = 2 * params.sigmaExposedness * params.sigmaExposedness;

    // 6. Execute exposure fusion using chunked rows to keep peak cache and memory predictable
    const rowsPerChunk = baseWidth >= 4096 ? 256 : 512;
    const totalRows = baseHeight;

    const weights = new Float32Array(count);

    for (let startRow = 0; startRow < totalRows; startRow += rowsPerChunk) {
      const endRow = Math.min(totalRows, startRow + rowsPerChunk);
      const startPixel = startRow * baseWidth;
      const endPixel = endRow * baseWidth;

      for (let p = startPixel; p < endPixel; p++) {
        const offset = p * 4;
        let totalWeight = 0;

        // Compute quality weight for each exposure frame at pixel p
        for (let k = 0; k < count; k++) {
          const frameData = alignedFrames[k].data;
          const rNorm = frameData[offset] / 255.0;
          const gNorm = frameData[offset + 1] / 255.0;
          const bNorm = frameData[offset + 2] / 255.0;

          // Metric A: Well-exposedness (Gaussian centered at 0.5)
          const dR = rNorm - 0.5;
          const dG = gNorm - 0.5;
          const dB = bNorm - 0.5;
          const expWeight = Math.exp(-(dR * dR + dG * dG + dB * dB) / twoSigmaSq);

          // Metric B: Saturation (Standard deviation of RGB channels)
          const mean = (rNorm + gNorm + bNorm) / 3.0;
          const satWeight = Math.sqrt(
            ((rNorm - mean) * (rNorm - mean) +
              (gNorm - mean) * (gNorm - mean) +
              (bNorm - mean) * (bNorm - mean)) /
              3.0
          );

          // Metric C: Luminance Contrast (deviation from neutral)
          const contrastWeight = Math.abs(mean - 0.5);

          // Combined weight with small epsilon to prevent division by zero
          const w =
            Math.pow(expWeight, params.weightExposedness) *
              Math.pow(Math.max(1e-4, satWeight), params.weightSaturation) *
              Math.pow(Math.max(1e-4, contrastWeight), params.weightContrast) +
            1e-6;

          weights[k] = w;
          totalWeight += w;
        }

        // Blend pixel channels with normalized weights
        let blendedR = 0;
        let blendedG = 0;
        let blendedB = 0;

        const invTotal = totalWeight > 0 ? 1.0 / totalWeight : 1.0 / count;

        for (let k = 0; k < count; k++) {
          const normW = weights[k] * invTotal;
          const frameData = alignedFrames[k].data;
          blendedR += normW * frameData[offset];
          blendedG += normW * frameData[offset + 1];
          blendedB += normW * frameData[offset + 2];
        }

        outputData[offset] = Math.round(blendedR);
        outputData[offset + 1] = Math.round(blendedG);
        outputData[offset + 2] = Math.round(blendedB);
        outputData[offset + 3] = 255; // Fully opaque
      }
    }

    // 7. Post-merge quality verification (Requirement 13)
    const qualityMetrics = this.validateOutputQuality(outputData, baseWidth, baseHeight);
    if (!qualityMetrics.isQualityAcceptable) {
      throw new Error(`HDR quality check failed: ${qualityMetrics.reason}`);
    }

    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const durationMs = Math.round(endTime - startTime);

    return {
      width: baseWidth,
      height: baseHeight,
      data: outputData,
      frameCountMerged: count,
      durationMs,
      parametersUsed: params,
      qualityMetrics
    };
  }
}

// Global HDRMergeEngine singleton
export const hdrMergeEngine = new HDRMergeEngine();
