/**
 * ============================================================================
 * RenderWalk Pairwise Frame Matching & RANSAC Geometric Verifier (Task 33)
 * ============================================================================
 *
 * Implements authoritative pairwise matching between neighboring frames:
 * - Nearest-neighbor Euclidean descriptor matching with Lowe's ratio test
 * - RANSAC geometric verification (affine / translation pose estimation)
 * - Inlier thresholding and status classification (MATCHED, WEAK_MATCH, NO_MATCH, ERROR)
 * - Handles sequential neighbors and Point 8 <-> Point 1 wraparound pair
 */

import {
  DetectedFeature,
  PairwiseFrameMatch,
  GeometricVerificationResult,
  AlignmentMatchStatus
} from "./ReconstructionModels";

export class PairwiseMatchingEngine {
  private ratioThreshold: number;
  private ransacIterations: number;
  private inlierDistanceThreshold: number;

  constructor(
    ratioThreshold = 0.85,
    ransacIterations = 100,
    inlierDistanceThreshold = 8.0
  ) {
    this.ratioThreshold = ratioThreshold;
    this.ransacIterations = ransacIterations;
    this.inlierDistanceThreshold = inlierDistanceThreshold;
  }

  /**
   * Matches features between two frames and applies RANSAC geometric verification.
   */
  public matchFrames(
    sourcePointId: number,
    targetPointId: number,
    sourceAssetId: string,
    targetAssetId: string,
    featuresA: readonly DetectedFeature[],
    featuresB: readonly DetectedFeature[],
    isWraparound = false
  ): PairwiseFrameMatch {
    const pairKey = `Point ${sourcePointId} <-> Point ${targetPointId}`;

    if (!featuresA || featuresA.length === 0 || !featuresB || featuresB.length === 0) {
      return {
        pairKey,
        sourcePointId,
        targetPointId,
        sourceAssetId,
        targetAssetId,
        isWraparound,
        candidateMatchesCount: 0,
        geometricVerification: {
          transformationMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
          inlierCount: 0,
          totalMatches: 0,
          inlierRatio: 0.0,
          verified: false,
          failureReason: "Insufficient detected features in one or both frames"
        },
        status: "NO_MATCH",
        matchQualityScore: 0.0
      };
    }

    // 1. Find candidate matches using nearest neighbor with Lowe's ratio test
    const candidateMatches: { ptA: DetectedFeature; ptB: DetectedFeature; dist: number }[] = [];

    for (const fA of featuresA) {
      let bestDist = Infinity;
      let secondDist = Infinity;
      let bestMatch: DetectedFeature | null = null;

      for (const fB of featuresB) {
        const d = this.descriptorDistance(fA.descriptor, fB.descriptor);
        if (d < bestDist) {
          secondDist = bestDist;
          bestDist = d;
          bestMatch = fB;
        } else if (d < secondDist) {
          secondDist = d;
        }
      }

      // Lowe's ratio test: accept if best match is significantly closer than second best,
      // or if best match is an exact/near-exact match (dist < 0.05)
      if (bestMatch && (bestDist < 0.05 || (isFinite(secondDist) && bestDist <= this.ratioThreshold * secondDist))) {
        candidateMatches.push({ ptA: fA, ptB: bestMatch, dist: bestDist });
      }
    }

    if (candidateMatches.length < 4) {
      return {
        pairKey,
        sourcePointId,
        targetPointId,
        sourceAssetId,
        targetAssetId,
        isWraparound,
        candidateMatchesCount: candidateMatches.length,
        geometricVerification: {
          transformationMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
          inlierCount: 0,
          totalMatches: candidateMatches.length,
          inlierRatio: 0.0,
          verified: false,
          failureReason: "Insufficient candidate matches for geometric model estimation (< 4)"
        },
        status: "NO_MATCH",
        matchQualityScore: 0.0
      };
    }

    // 2. RANSAC 2D Affine / Rigid Transformation Estimation
    const verification = this.estimateGeometricTransformationRansac(candidateMatches);

    // 3. Classify status based on verified inliers and inlier ratio
    let status: AlignmentMatchStatus = "NO_MATCH";
    if (verification.inlierCount >= 12 && verification.inlierRatio >= 0.35) {
      status = "MATCHED";
    } else if (verification.inlierCount >= 6 && verification.inlierRatio >= 0.15) {
      status = "WEAK_MATCH";
    } else {
      status = "NO_MATCH";
    }

    const matchQualityScore = Math.min(1.0, verification.inlierRatio * (verification.inlierCount / 20.0));

    return {
      pairKey,
      sourcePointId,
      targetPointId,
      sourceAssetId,
      targetAssetId,
      isWraparound,
      candidateMatchesCount: candidateMatches.length,
      geometricVerification: verification,
      status,
      matchQualityScore: Math.round(matchQualityScore * 1000) / 1000
    };
  }

  /**
   * Euclidean distance between two normalized descriptor vectors.
   */
  private descriptorDistance(d1: readonly number[], d2: readonly number[]): number {
    let sum = 0;
    const len = Math.min(d1.length, d2.length);
    for (let i = 0; i < len; i++) {
      const diff = d1[i] - d2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Estimates a 2D affine model (translation + scale/rotation) using RANSAC.
   */
  private estimateGeometricTransformationRansac(
    matches: readonly { ptA: DetectedFeature; ptB: DetectedFeature }[]
  ): GeometricVerificationResult {
    let bestInliersCount = 0;
    let bestInliersIndices: number[] = [];
    let bestMatrix: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

    const n = matches.length;

    for (let iter = 0; iter < this.ransacIterations; iter++) {
      // Pick 2 distinct random match pairs
      const idx1 = Math.floor(Math.random() * n);
      let idx2 = Math.floor(Math.random() * n);
      while (idx2 === idx1 && n > 1) {
        idx2 = Math.floor(Math.random() * n);
      }

      const m1 = matches[idx1];
      const m2 = matches[idx2];

      const dxA = m2.ptA.x - m1.ptA.x;
      const dyA = m2.ptA.y - m1.ptA.y;
      const dxB = m2.ptB.x - m1.ptB.x;
      const dyB = m2.ptB.y - m1.ptB.y;

      const distA = Math.sqrt(dxA * dxA + dyA * dyA);
      const distB = Math.sqrt(dxB * dxB + dyB * dyB);

      if (distA < 2.0 || distB < 2.0) continue;

      // Scale & rotation
      const scale = distB / distA;
      const angleA = Math.atan2(dyA, dxA);
      const angleB = Math.atan2(dyB, dxB);
      const theta = angleB - angleA;

      const cosT = scale * Math.cos(theta);
      const sinT = scale * Math.sin(theta);

      // Translation
      const tx = m1.ptB.x - (cosT * m1.ptA.x - sinT * m1.ptA.y);
      const ty = m1.ptB.y - (sinT * m1.ptA.x + cosT * m1.ptA.y);

      // Count inliers
      const inliers: number[] = [];
      for (let i = 0; i < n; i++) {
        const pA = matches[i].ptA;
        const pB = matches[i].ptB;

        const projX = cosT * pA.x - sinT * pA.y + tx;
        const projY = sinT * pA.x + cosT * pA.y + ty;

        const errX = pB.x - projX;
        const errY = pB.y - projY;
        const errDist = Math.sqrt(errX * errX + errY * errY);

        if (errDist <= this.inlierDistanceThreshold) {
          inliers.push(i);
        }
      }

      if (inliers.length > bestInliersCount) {
        bestInliersCount = inliers.length;
        bestInliersIndices = inliers;
        bestMatrix = [
          [cosT, -sinT, tx],
          [sinT, cosT, ty],
          [0, 0, 1]
        ];
      }
    }

    const inlierRatio = n > 0 ? Math.round((bestInliersCount / n) * 1000) / 1000 : 0;
    const verified = bestInliersCount >= 6 && inlierRatio >= 0.15;

    return {
      transformationMatrix: bestMatrix,
      inlierCount: bestInliersCount,
      totalMatches: n,
      inlierRatio,
      verified,
      failureReason: verified ? undefined : `Low inlier support (${bestInliersCount}/${n}, ratio: ${inlierRatio})`
    };
  }
}
