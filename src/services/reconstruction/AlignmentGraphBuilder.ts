/**
 * ============================================================================
 * RenderWalk Alignment Graph Builder (Task 33)
 * ============================================================================
 *
 * Coordinates the full Task 33 preparation and alignment stage:
 * 1. Image preparation & normalization
 * 2. Visual feature detection across all 8 capture points
 * 3. Pairwise matching for sequential neighbors (1-2, 2-3, ..., 7-8) + wraparound (8-1)
 * 4. Geometric RANSAC verification
 * 5. Reconstruction graph synthesis & timing metrics
 *
 * Produces the immutable AlignmentGraphArtifact for downstream Task 34 stitching.
 */

import { StorageService } from "../../../packages/storage/src/StorageService";
import { ProcessingInputManifest } from "../processing/ProcessingJobModel";
import {
  AlignmentGraphArtifact,
  AlignmentGraphNode,
  PairwiseFrameMatch,
  DetectedFeature,
  PreparedWorkingImage,
  CaptureSource,
  ReconstructionInputType
} from "./ReconstructionModels";
import { ImagePreparationService } from "./ImagePreparationService";
import { FeatureDetectionEngine } from "./FeatureDetectionEngine";
import { PairwiseMatchingEngine } from "./PairwiseMatchingEngine";

export class AlignmentGraphBuilder {
  private prepService: ImagePreparationService;
  private detectionEngine: FeatureDetectionEngine;
  private matchingEngine: PairwiseMatchingEngine;

  constructor(
    storageService: StorageService,
    prepService?: ImagePreparationService,
    detectionEngine?: FeatureDetectionEngine,
    matchingEngine?: PairwiseMatchingEngine
  ) {
    this.prepService = prepService || new ImagePreparationService(storageService);
    this.detectionEngine = detectionEngine || new FeatureDetectionEngine();
    this.matchingEngine = matchingEngine || new PairwiseMatchingEngine();
  }

  /**
   * Builds the complete capture-sequence alignment graph from a validated input manifest.
   */
  public async buildGraph(
    manifest: ProcessingInputManifest,
    onProgress?: (stage: string, percent: number) => Promise<void>
  ): Promise<AlignmentGraphArtifact> {
    const totalStart = Date.now();

    const sourceType: CaptureSource = manifest.sourceType || "PHONE_GUIDED";
    const inputType: ReconstructionInputType = manifest.inputType || "PERSPECTIVE_PHOTO_SET";

    // Audit environment dependencies
    const depAudit = this.prepService.auditDependencies();

    // -----------------------------------------------------------------------
    // STAGE 1: PREPARING_IMAGES
    // -----------------------------------------------------------------------
    await onProgress?.("PREPARING_IMAGES", 10);
    const prepStart = Date.now();

    // Sort source images if sequence order or capturePointId exists
    const sortedManifests = [...manifest.sourceImages].sort((a, b) => {
      const ordA = a.capturePointId ?? a.sequenceOrder ?? 0;
      const ordB = b.capturePointId ?? b.sequenceOrder ?? 0;
      return ordA - ordB;
    });

    const preparedImages: PreparedWorkingImage[] = [];
    for (let i = 0; i < sortedManifests.length; i++) {
      const prep = await this.prepService.prepareImage(sortedManifests[i], i + 1);
      preparedImages.push(prep);
    }
    const prepMs = Date.now() - prepStart;

    // -----------------------------------------------------------------------
    // STAGE 2: DETECTING_FEATURES
    // -----------------------------------------------------------------------
    await onProgress?.("DETECTING_FEATURES", 35);
    const detectStart = Date.now();

    const imageFeaturesMap = new Map<number, DetectedFeature[]>();
    for (const img of preparedImages) {
      const features = this.detectionEngine.detectFeatures(img);
      imageFeaturesMap.set(img.capturePointId, features);
    }
    const detectMs = Date.now() - detectStart;

    // -----------------------------------------------------------------------
    // STAGE 3: MATCHING_FRAMES
    // -----------------------------------------------------------------------
    await onProgress?.("MATCHING_FRAMES", 65);
    const matchStart = Date.now();

    const matches: PairwiseFrameMatch[] = [];

    // Pair scheduling:
    // If PHONE_GUIDED and exactly 8 images:
    // Use guided sequential pairs (1-2, 2-3, 3-4, 4-5, 5-6, 6-7, 7-8) + (8-1) wraparound
    // If FILE_IMPORT or arbitrary N:
    // Evaluate candidate pairs between images without assuming order or wraparound.
    const pairSchedule: { src: number; tgt: number; isWraparound: boolean }[] = [];
    const n = preparedImages.length;

    if (sourceType === "PHONE_GUIDED" && n === 8) {
      for (let i = 1; i < 8; i++) {
        pairSchedule.push({ src: i, tgt: i + 1, isWraparound: false });
      }
      pairSchedule.push({ src: 8, tgt: 1, isWraparound: true });
    } else {
      // General perspective photo set:
      // For N <= 15, evaluate all unique pairs (i, j).
      // For N > 15, bound candidate pairs to prevent O(N^2) runaway work.
      const maxCandidatePairs = 100;
      let count = 0;
      for (let i = 0; i < n && count < maxCandidatePairs; i++) {
        for (let j = i + 1; j < n && count < maxCandidatePairs; j++) {
          const ptA = preparedImages[i].capturePointId;
          const ptB = preparedImages[j].capturePointId;
          pairSchedule.push({ src: ptA, tgt: ptB, isWraparound: false });
          count++;
        }
      }
    }

    for (const pair of pairSchedule) {
      const srcImg = preparedImages.find((img) => img.capturePointId === pair.src);
      const tgtImg = preparedImages.find((img) => img.capturePointId === pair.tgt);

      if (!srcImg || !tgtImg) {
        matches.push({
          pairKey: `Point ${pair.src} <-> Point ${pair.tgt}`,
          sourcePointId: pair.src,
          targetPointId: pair.tgt,
          sourceAssetId: srcImg?.assetId || "missing",
          targetAssetId: tgtImg?.assetId || "missing",
          isWraparound: pair.isWraparound,
          candidateMatchesCount: 0,
          geometricVerification: {
            transformationMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            inlierCount: 0,
            totalMatches: 0,
            inlierRatio: 0,
            verified: false,
            failureReason: `One or both frames missing (Point ${pair.src} or ${pair.tgt})`
          },
          status: "ERROR",
          matchQualityScore: 0
        });
        continue;
      }

      const featsA = imageFeaturesMap.get(pair.src) || [];
      const featsB = imageFeaturesMap.get(pair.tgt) || [];

      const matchResult = this.matchingEngine.matchFrames(
        pair.src,
        pair.tgt,
        srcImg.assetId,
        tgtImg.assetId,
        featsA,
        featsB,
        pair.isWraparound
      );

      matches.push(matchResult);
    }
    const matchMs = Date.now() - matchStart;

    // -----------------------------------------------------------------------
    // STAGE 4: BUILDING_ALIGNMENT_GRAPH
    // -----------------------------------------------------------------------
    await onProgress?.("BUILDING_ALIGNMENT_GRAPH", 90);
    const graphStart = Date.now();

    const nodes: AlignmentGraphNode[] = preparedImages.map((img) => ({
      capturePointId: img.capturePointId,
      assetId: img.assetId,
      originalFilename: img.originalFilename,
      targetHeadingDegrees: img.targetHeadingDegrees,
      actualHeadingDegrees: img.actualHeadingDegrees,
      detectedFeaturesCount: (imageFeaturesMap.get(img.capturePointId) || []).length,
      dimensions: { width: img.originalWidth, height: img.originalHeight }
    }));

    const verifiedEdgesCount = matches.filter((m) => m.status === "MATCHED").length;
    const weakEdgesCount = matches.filter((m) => m.status === "WEAK_MATCH").length;
    const failedEdgesCount = matches.filter((m) => m.status === "NO_MATCH" || m.status === "ERROR").length;

    const graphMs = Date.now() - graphStart;
    const totalMs = Date.now() - totalStart;

    // Cleanup temporary working files
    this.prepService.cleanupTemporaryFiles();

    await onProgress?.("AWAITING_STITCHING_PIPELINE", 100);

    return {
      sessionId: manifest.sessionId,
      organizationId: manifest.organizationId,
      tourId: manifest.tourId,
      sourceType,
      inputType,
      totalImagesProcessed: preparedImages.length,
      nodes,
      edges: matches,
      verifiedEdgesCount,
      weakEdgesCount,
      failedEdgesCount,
      timingsMs: {
        preparationMs: prepMs,
        detectionMs: detectMs,
        matchingMs: matchMs,
        graphAssemblyMs: graphMs,
        totalPipelineMs: totalMs
      },
      dependencyAudit: {
        computerVisionEngine: depAudit.engine,
        externalNeuralMatcher: depAudit.neuralMatcherStatus,
        fixtureStatus: depAudit.fixtureStatus
      },
      resultSummary: "Source images prepared and alignment graph generated.",
      createdAt: new Date().toISOString()
    };
  }
}
