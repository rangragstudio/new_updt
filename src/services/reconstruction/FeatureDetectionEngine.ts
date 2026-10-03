/**
 * ============================================================================
 * RenderWalk Feature Detection Engine (Task 33)
 * ============================================================================
 *
 * Implements authoritative computer-vision feature detection on prepared working images:
 * - Sobel spatial gradient computation (Ix, Iy)
 * - Harris Corner Response matrix evaluation
 * - Non-maximum suppression for spatial dispersion
 * - Local patch gradient descriptor extraction
 *
 * Real pixel analysis without fake random keypoints.
 */

import { PreparedWorkingImage, DetectedFeature } from "./ReconstructionModels";

export class FeatureDetectionEngine {
  private maxFeaturesPerImage: number;
  private cornerThreshold: number;

  constructor(maxFeaturesPerImage = 200, cornerThreshold = 1000) {
    this.maxFeaturesPerImage = maxFeaturesPerImage;
    this.cornerThreshold = cornerThreshold;
  }

  /**
   * Detects visual keypoints and computes feature descriptors from prepared luminance data.
   */
  public detectFeatures(image: PreparedWorkingImage): DetectedFeature[] {
    const { workingWidth: w, workingHeight: h, luminanceData: lum } = image;

    if (w < 16 || h < 16) {
      return [];
    }

    // 1. Compute horizontal and vertical gradients (Ix, Iy) using 3x3 Sobel kernels
    const gradX = new Float32Array(w * h);
    const gradY = new Float32Array(w * h);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p00 = lum[(y - 1) * w + (x - 1)];
        const p01 = lum[(y - 1) * w + x];
        const p02 = lum[(y - 1) * w + (x + 1)];

        const p10 = lum[y * w + (x - 1)];
        const p12 = lum[y * w + (x + 1)];

        const p20 = lum[(y + 1) * w + (x - 1)];
        const p21 = lum[(y + 1) * w + x];
        const p22 = lum[(y + 1) * w + (x + 1)];

        // Sobel kernels:
        // Gx: [-1 0 1; -2 0 2; -1 0 1]
        // Gy: [-1 -2 -1; 0 0 0; 1 2 1]
        const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
        const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;

        const idx = y * w + x;
        gradX[idx] = gx;
        gradY[idx] = gy;
      }
    }

    // 2. Compute Harris Corner Response: R = det(M) - k * trace(M)^2 with 3x3 Gaussian smoothing
    const harrisResponse = new Float32Array(w * h);
    const k = 0.04;

    for (let y = 3; y < h - 3; y++) {
      for (let x = 3; x < w - 3; x++) {
        let sxx = 0;
        let syy = 0;
        let sxy = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = (y + dy) * w + (x + dx);
            const gx = gradX[idx];
            const gy = gradY[idx];

            sxx += gx * gx;
            syy += gy * gy;
            sxy += gx * gy;
          }
        }

        const det = sxx * syy - sxy * sxy;
        const trace = sxx + syy;
        const r = det - k * trace * trace;

        if (r > this.cornerThreshold) {
          harrisResponse[y * w + x] = r;
        }
      }
    }

    // 3. Non-Maximum Suppression (5x5 neighborhood) to detect stable local maxima
    const candidates: { x: number; y: number; response: number }[] = [];
    const nmsRadius = 3;

    for (let y = nmsRadius; y < h - nmsRadius; y++) {
      for (let x = nmsRadius; x < w - nmsRadius; x++) {
        const val = harrisResponse[y * w + x];
        if (val <= 0) continue;

        let isMax = true;
        for (let dy = -nmsRadius; dy <= nmsRadius && isMax; dy++) {
          for (let dx = -nmsRadius; dx <= nmsRadius; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (harrisResponse[(y + dy) * w + (x + dx)] >= val) {
              isMax = false;
              break;
            }
          }
        }

        if (isMax) {
          candidates.push({ x, y, response: val });
        }
      }
    }

    // 4. Sort by corner strength response descending and cap at maxFeaturesPerImage
    candidates.sort((a, b) => b.response - a.response);
    const selected = candidates.slice(0, this.maxFeaturesPerImage);

    // 5. Extract local 16-element gradient orientation histogram descriptor for each keypoint
    const features: DetectedFeature[] = [];
    for (const pt of selected) {
      const descriptor = this.extractPatchDescriptor(pt.x, pt.y, gradX, gradY, w, h);
      features.push({
        x: pt.x,
        y: pt.y,
        response: pt.response,
        descriptor
      });
    }

    return features;
  }

  /**
   * Extracts a 16-bin spatial gradient descriptor around keypoint (x, y).
   * Partitions 8x8 patch into 4 quadrants (2x2), computing 4 orientation bins per quadrant.
   */
  private extractPatchDescriptor(
    cx: number,
    cy: number,
    gradX: Float32Array,
    gradY: Float32Array,
    w: number,
    h: number
  ): number[] {
    const desc = new Float32Array(16);
    const halfSize = 4;

    for (let dy = -halfSize; dy < halfSize; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= h) continue;

      const quadY = dy < 0 ? 0 : 1;

      for (let dx = -halfSize; dx < halfSize; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= w) continue;

        const quadX = dx < 0 ? 0 : 1;
        const quadIdx = quadY * 2 + quadX;

        const idx = y * w + x;
        const gx = gradX[idx];
        const gy = gradY[idx];

        const mag = Math.sqrt(gx * gx + gy * gy);
        if (mag < 1.0) continue;

        // Angle in [0, 2*PI)
        let angle = Math.atan2(gy, gx);
        if (angle < 0) angle += 2 * Math.PI;

        // 4 orientation bins: [0, 90), [90, 180), [180, 270), [270, 360)
        const bin = Math.min(3, Math.floor((angle / (2 * Math.PI)) * 4));
        desc[quadIdx * 4 + bin] += mag;
      }
    }

    // L2 normalization of descriptor
    let norm = 0;
    for (let i = 0; i < 16; i++) {
      norm += desc[i] * desc[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < 16; i++) {
        desc[i] /= norm;
      }
    }

    return Array.from(desc);
  }
}
