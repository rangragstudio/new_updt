/**
 * ============================================================================
 * RenderWalk Server Processing Job Models & State Machine (Task 32)
 * ============================================================================
 *
 * Implements authoritative server-side processing job representation,
 * input manifest structure, customer-facing status mapping, and state machine.
 */

export type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type CustomerFacingJobStatus =
  | "Ready for processing"
  | "Processing"
  | "Completed"
  | "Needs attention";

/**
 * Maps internal worker state machine to customer-facing status.
 * Hides technical implementation details (pg-boss, R2, worker, internal IDs).
 */
export function toCustomerFacingStatus(status: JobStatus): CustomerFacingJobStatus {
  switch (status) {
    case "QUEUED":
      return "Ready for processing";
    case "RUNNING":
      return "Processing";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
    case "CANCELLED":
      return "Needs attention";
  }
}

import {
  CaptureSource,
  ReconstructionInputType,
  ExifMetadataHints
} from "../reconstruction/ReconstructionModels";

/**
 * Metadata representation of a verified single source image asset within a capture session.
 */
export interface SourceImageAssetManifest {
  readonly assetId: string;
  readonly storageKey: string;             // Reference in StorageService (no binary in job record)
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
  };
  readonly fileSizeBytes: number;
  readonly capturePointId?: number;        // 1 to N (optional for unordered file imports)
  readonly targetHeadingDegrees?: number;  // Optional guidance hint
  readonly actualHeadingDegrees?: number;  // Optional guidance hint
  readonly captureTimestamp?: number;      // Optional guidance hint
  readonly originalFilename?: string;
  readonly mimeType?: string;
  readonly exifMetadata?: ExifMetadataHints;
  readonly sequenceOrder?: number;
}

/**
 * Complete immutable input manifest required by workers to process a capture sequence.
 */
export interface ProcessingInputManifest {
  readonly sessionId: string;
  readonly organizationId: string;
  readonly tourId?: string;
  readonly sourceType?: CaptureSource;              // PHONE_GUIDED | FILE_IMPORT | EXTERNAL_CAMERA
  readonly inputType?: ReconstructionInputType;     // PERSPECTIVE_PHOTO_SET | EXISTING_EQUIRECTANGULAR_PANORAMA
  readonly totalSourceImages: number;              // Dynamic N >= 2
  readonly sourceImages: readonly SourceImageAssetManifest[];
}

/**
 * Core ProcessingJob representation extending the database conventions.
 */
export interface ProcessingJob {
  readonly id: string;
  readonly organizationId: string;
  readonly tourId?: string;
  readonly sessionId: string;
  readonly type: "ROOM_RECONSTRUCTION" | "PANORAMA_STITCH" | "MAKE_PREVIEW";
  status: JobStatus;
  progress: number;                         // 0 to 100
  step?: string;
  readonly priority: number;                // Configurable priority value (higher = prioritized)
  attempts: number;
  readonly maxAttempts: number;
  errorMessage?: string;
  workerId?: string;
  readonly inputManifest: ProcessingInputManifest;
  readonly createdAt: string;               // ISO 8601
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

/**
 * Validates state transitions to prevent illegal state mutations.
 */
export class JobStateMachine {
  private static validTransitions: Record<JobStatus, readonly JobStatus[]> = {
    QUEUED: ["RUNNING", "CANCELLED"],
    RUNNING: ["COMPLETED", "FAILED", "CANCELLED", "QUEUED"], // Can re-queue on transient retry
    COMPLETED: [],                                          // Terminal
    FAILED: ["QUEUED"],                                     // Can be retried
    CANCELLED: []                                           // Terminal
  };

  public static canTransition(current: JobStatus, target: JobStatus): boolean {
    return this.validTransitions[current]?.includes(target) ?? false;
  }

  public static assertTransition(current: JobStatus, target: JobStatus): void {
    if (!this.canTransition(current, target)) {
      throw new Error(`Invalid job state transition: cannot transition from ${current} to ${target}`);
    }
  }
}
