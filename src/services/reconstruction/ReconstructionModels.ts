/**
 * ============================================================================
 * RenderWalk Reconstruction Models & Alignment Graph (Task 33 / 33A / 34)
 * ============================================================================
 *
 * Types and interfaces for source image preparation, feature detection,
 * pairwise geometric verification, alignment graphs, and relative camera pose solving.
 */

export type CaptureSource = "PHONE_GUIDED" | "FILE_IMPORT" | "EXTERNAL_CAMERA";

export type ReconstructionInputType =
  | "EXISTING_EQUIRECTANGULAR_PANORAMA"
  | "PERSPECTIVE_PHOTO_SET";

export type InputValidationState =
  | "VALID_EQUIRECTANGULAR_PANORAMA"
  | "VALID_PERSPECTIVE_PHOTO_SET"
  | "INSUFFICIENT_RECONSTRUCTION_INPUT"
  | "UNSUPPORTED_IMAGE_FORMAT"
  | "CORRUPTED_IMAGE"
  | "INSUFFICIENT_VISUAL_OVERLAP";

export type AlignmentMatchStatus = "MATCHED" | "WEAK_MATCH" | "NO_MATCH" | "ERROR";

export type ReconstructionWorkerStage =
  | "QUEUED"
  | "PREPARING_IMAGES"
  | "DETECTING_FEATURES"
  | "MATCHING_FRAMES"
  | "BUILDING_ALIGNMENT_GRAPH"
  | "SOLVING_CAMERA_POSES"
  | "AWAITING_STITCHING_PIPELINE";

/**
 * Detected visual feature / keypoint in a source image.
 */
export interface DetectedFeature {
  readonly x: number;              // Pixel coordinate in working resolution
  readonly y: number;
  readonly response: number;       // Corner strength response
  readonly descriptor: number[];   // Visual gradient descriptor vector
}

/**
 * Optional EXIF metadata hints from photographic capture.
 */
export interface ExifMetadataHints {
  readonly orientation?: number;
  readonly focalLengthMm?: number;
  readonly cameraMake?: string;
  readonly cameraModel?: string;
  readonly iso?: number;
  readonly exposureTime?: number;
}

/**
 * Prepared working image metadata (original source is kept immutable).
 */
export interface PreparedWorkingImage {
  readonly assetId: string;
  readonly capturePointId: number;        // 1 to N
  readonly originalStorageKey: string;
  readonly originalFilename?: string;
  readonly originalWidth: number;
  readonly originalHeight: number;
  readonly workingWidth: number;
  readonly workingHeight: number;
  readonly targetHeadingDegrees?: number; // Optional hint
  readonly actualHeadingDegrees?: number; // Optional hint
  readonly captureTimestamp?: number;     // Optional hint
  readonly exifMetadata?: ExifMetadataHints;
  readonly luminanceData: Uint8Array;     // 8-bit grayscale for feature analysis
  readonly temporaryWorkingPath?: string;
}

/**
 * Geometric verification result between two images.
 */
export interface GeometricVerificationResult {
  readonly transformationMatrix: number[][]; // 3x3 Homography / Affine transformation
  readonly inlierCount: number;
  readonly totalMatches: number;
  readonly inlierRatio: number;
  readonly verified: boolean;
  readonly failureReason?: string;
}

/**
 * Pairwise match relationship between two capture points.
 */
export interface PairwiseFrameMatch {
  readonly pairKey: string;         // e.g. "Image 1 <-> Image 2"
  readonly sourcePointId: number;
  readonly targetPointId: number;
  readonly sourceAssetId: string;
  readonly targetAssetId: string;
  readonly isWraparound: boolean;   // true if verified circular closure
  readonly candidateMatchesCount: number;
  readonly geometricVerification: GeometricVerificationResult;
  readonly status: AlignmentMatchStatus;
  readonly matchQualityScore: number; // 0.0 to 1.0
}

/**
 * Node in the capture-sequence reconstruction graph.
 */
export interface AlignmentGraphNode {
  readonly capturePointId: number;
  readonly assetId: string;
  readonly originalFilename?: string;
  readonly targetHeadingDegrees?: number;
  readonly actualHeadingDegrees?: number;
  readonly detectedFeaturesCount: number;
  readonly dimensions: { width: number; height: number };
}

/**
 * Output artifact produced by AlignmentGraphBuilder.
 */
export interface AlignmentGraphArtifact {
  readonly sessionId: string;
  readonly organizationId: string;
  readonly tourId?: string;
  readonly sourceType: CaptureSource;
  readonly inputType: ReconstructionInputType;
  readonly totalImagesProcessed: number;
  readonly nodes: readonly AlignmentGraphNode[];
  readonly edges: readonly PairwiseFrameMatch[];
  readonly verifiedEdgesCount: number;
  readonly weakEdgesCount: number;
  readonly failedEdgesCount: number;
  readonly timingsMs: {
    readonly preparationMs: number;
    readonly detectionMs: number;
    readonly matchingMs: number;
    readonly graphAssemblyMs: number;
    readonly totalPipelineMs: number;
  };
  readonly dependencyAudit: {
    readonly computerVisionEngine: string;
    readonly externalNeuralMatcher: string; // "FEATURE_MATCHING_DEPENDENCY_NOT_AVAILABLE" if LightGlue/PyTorch not installed
    readonly fixtureStatus: string;         // "RECONSTRUCTION_FIXTURE_NOT_AVAILABLE" if real 8-point room fixture absent
  };
  readonly resultSummary: string;
  readonly createdAt: string;
}

// ============================================================================
// TASK 34 — CAMERA POSE SOLVING MODELS
// ============================================================================

export type CameraPoseSolvingStatus =
  | "SOLVED"
  | "INSUFFICIENT_RECONSTRUCTION_GRAPH"
  | "OPTIMIZATION_FAILED";

/**
 * Solved relative pose for an image within the global reconstruction frame.
 */
export interface SolvedCameraPose {
  readonly assetId: string;
  readonly capturePointId?: number;
  readonly originalFilename?: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotationDegrees: number; // Yaw angle in degrees [0, 360) relative to reference frame
  readonly rotationMatrix: number[][]; // 3x3 rigid transformation matrix
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly auxiliaryMetadata: {
    readonly targetHeadingDegrees?: number;
    readonly actualHeadingDegrees?: number;
    readonly exifFocalLengthMm?: number;
    readonly intrinsicsAvailable: boolean; // false if unavailable
  };
}

/**
 * Connected component analysis metrics.
 */
export interface ConnectedComponentInfo {
  readonly size: number;
  readonly totalImages: number;
  readonly isFullyConnected: boolean;
  readonly reachableAssetIds: readonly string[];
  readonly unreachableAssetIds: readonly string[];
}

/**
 * Output artifact produced at the end of Task 34.
 * Represents consistent relative camera poses derived from the alignment graph.
 */
export interface CameraPoseArtifact {
  readonly organizationId: string;
  readonly processingJobId: string;
  readonly captureSessionId: string;
  readonly tourId?: string;
  readonly sourceType: CaptureSource;
  readonly inputType: ReconstructionInputType;
  readonly referenceAssetId: string;
  readonly cameraPoses: readonly SolvedCameraPose[];
  readonly connectedComponent: ConnectedComponentInfo;
  readonly verifiedEdgeCount: number;
  readonly weakEdgeCount: number;
  readonly rejectedEdgeCount: number;
  readonly residualBefore: number;
  readonly residualAfter: number;
  readonly loopClosureUsed: boolean;
  readonly processingTimings: {
    readonly graphValidationMs: number;
    readonly initialPoseSolvingMs: number;
    readonly graphOptimizationMs: number;
    readonly totalPoseSolvingMs: number;
  };
  readonly status: CameraPoseSolvingStatus;
  readonly failureReason?: string;
  readonly resultSummary: string; // "Camera poses solved from alignment graph. Awaiting stitching pipeline."
  readonly createdAt: string;
}
