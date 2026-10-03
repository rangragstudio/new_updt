/**
 * ============================================================================
 * RenderWalk Processing Job Service (Task 32)
 * ============================================================================
 *
 * Implements server-side processing job creation, strict input validation,
 * tenant isolation, idempotency protection, and queue handoff.
 */

import { StorageService } from "../../../packages/storage/src/StorageService";
import { PlanService } from "../../../packages/plans/src/PlanService";
import {
  ProcessingJob,
  ProcessingInputManifest,
  SourceImageAssetManifest,
  toCustomerFacingStatus,
  CustomerFacingJobStatus
} from "./ProcessingJobModel";
import { ServerJobQueue } from "./ServerJobQueue";

import {
  CaptureSource,
  ReconstructionInputType
} from "../reconstruction/ReconstructionModels";

export interface UserAuthContext {
  readonly userId: string;
  readonly email: string;
  readonly memberships: readonly {
    readonly organizationId: string;
    readonly role: "OWNER" | "EDITOR" | "VIEWER";
  }[];
}

export interface RequestProcessingParams {
  readonly authContext: UserAuthContext;
  readonly organizationId: string;
  readonly sessionId: string;
  readonly tourId?: string;
  readonly type?: "ROOM_RECONSTRUCTION" | "PANORAMA_STITCH" | "MAKE_PREVIEW";
  readonly manifest: {
    readonly sourceType?: CaptureSource;
    readonly inputType?: ReconstructionInputType;
    readonly totalSourceImages: number;
    readonly sourceImages: readonly SourceImageAssetManifest[];
  };
}

export interface RequestProcessingResult {
  readonly job: ProcessingJob;
  readonly customerStatus: CustomerFacingJobStatus;
  readonly isExistingJob: boolean;
  readonly subscriptionPriorityStatus: string;
}

export class ProcessingValidationError extends Error {
  constructor(message: string, public readonly code = "VALIDATION_FAILED") {
    super(message);
    this.name = "ProcessingValidationError";
  }
}

export class TenantAccessError extends Error {
  constructor(message: string, public readonly code = "FORBIDDEN") {
    super(message);
    this.name = "TenantAccessError";
  }
}

export class ProcessingJobService {
  private queue: ServerJobQueue;
  private storageService: StorageService;
  private defaultPriority: number;

  constructor(
    queue: ServerJobQueue,
    storageService: StorageService,
    defaultPriority = 5
  ) {
    this.queue = queue;
    this.storageService = storageService;
    this.defaultPriority = defaultPriority;
  }

  /**
   * Main entry point to request a room processing job.
   * Performs authentication, tenant authorization, upload verification,
   * idempotency checking, and queue dispatch.
   */
  public async requestProcessing(params: RequestProcessingParams): Promise<RequestProcessingResult> {
    const { authContext, organizationId, sessionId, tourId, manifest } = params;

    // 1. Authenticate user & enforce tenant isolation
    if (!authContext || !authContext.userId) {
      throw new TenantAccessError("Authentication required to request processing.", "UNAUTHENTICATED");
    }

    const membership = authContext.memberships.find((m) => m.organizationId === organizationId);
    if (!membership) {
      throw new TenantAccessError(
        `User does not belong to organization '${organizationId}'. Access denied.`,
        "ORGANIZATION_MISMATCH"
      );
    }

    if (membership.role !== "OWNER" && membership.role !== "EDITOR") {
      throw new TenantAccessError(
        `Insufficient permissions in organization '${organizationId}'. Role '${membership.role}' cannot trigger processing.`,
        "INSUFFICIENT_ROLE"
      );
    }

    // 2. Validate input manifest completeness
    if (!manifest || !manifest.sourceImages) {
      throw new ProcessingValidationError("Input manifest is missing or empty.");
    }

    const sourceType: CaptureSource = manifest.sourceType || "PHONE_GUIDED";
    const totalImages = manifest.sourceImages.length;

    if (totalImages < 2) {
      throw new ProcessingValidationError(
        "INSUFFICIENT_RECONSTRUCTION_INPUT: At least 2 source images are required for reconstruction.",
        "INSUFFICIENT_RECONSTRUCTION_INPUT"
      );
    }

    if (sourceType === "PHONE_GUIDED") {
      if (manifest.totalSourceImages !== 8 || totalImages !== 8) {
        throw new ProcessingValidationError(
          `Incomplete capture set: expected exactly 8 source images, received ${totalImages}.`
        );
      }

      // Verify capture points sequence & uniqueness for guided phone capture
      const pointIds = manifest.sourceImages.map((img) => img.capturePointId);
      const uniquePoints = new Set(pointIds);
      if (uniquePoints.size !== 8) {
        throw new ProcessingValidationError("Duplicate capture point assignments detected in manifest.");
      }
      for (let i = 1; i <= 8; i++) {
        if (!uniquePoints.has(i)) {
          throw new ProcessingValidationError(`Capture point ${i} is missing from input manifest.`);
        }
      }
    }

    // 4. Verify physical storage asset existence for each source image
    for (let i = 0; i < manifest.sourceImages.length; i++) {
      const img = manifest.sourceImages[i];
      const identifier = img.capturePointId ? `point ${img.capturePointId}` : `image ${i + 1}`;
      if (!img.assetId) {
        throw new ProcessingValidationError(`Source ${identifier} is missing server asset ID.`);
      }
      if (!img.storageKey) {
        throw new ProcessingValidationError(`Source ${identifier} is missing storage reference key.`);
      }

      const fileExists = await this.storageService.exists(img.storageKey);
      if (!fileExists) {
        throw new ProcessingValidationError(
          `Source asset for ${identifier} not found in storage: '${img.storageKey}'.`
        );
      }

      if (img.dimensions.width <= 0 || img.dimensions.height <= 0) {
        throw new ProcessingValidationError(
          `Source asset for ${identifier} has invalid dimensions (${img.dimensions.width}x${img.dimensions.height}).`
        );
      }
    }

    // 5. Check Idempotency: Return existing active job if already queued or running
    const existingJob = await this.queue.findActiveJobBySession(sessionId);
    if (existingJob) {
      return {
        job: existingJob,
        customerStatus: toCustomerFacingStatus(existingJob.status),
        isExistingJob: true,
        subscriptionPriorityStatus: "SUBSCRIPTION_PRIORITY_NOT_AVAILABLE"
      };
    }

    // 6. Check subscription priority configuration honestly
    // PlanService does not currently define processing priorities -> report honestly per Section 7
    const subscriptionPriorityStatus = "SUBSCRIPTION_PRIORITY_NOT_AVAILABLE";
    const jobPriority = this.defaultPriority;

    // 7. Assemble full InputManifest
    const fullManifest: ProcessingInputManifest = {
      sessionId,
      organizationId,
      tourId,
      sourceType,
      inputType: manifest.inputType || "PERSPECTIVE_PHOTO_SET",
      totalSourceImages: totalImages,
      sourceImages: [...manifest.sourceImages]
    };

    // 8. Create ProcessingJob record
    const now = new Date().toISOString();
    const newJob: ProcessingJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      organizationId,
      tourId,
      sessionId,
      type: params.type || "ROOM_RECONSTRUCTION",
      status: "QUEUED",
      progress: 0,
      step: "Queued for worker execution",
      priority: jobPriority,
      attempts: 0,
      maxAttempts: 3,
      inputManifest: fullManifest,
      createdAt: now,
      updatedAt: now
    };

    // 9. Enqueue into Server Job Queue
    const queuedJob = await this.queue.enqueue(newJob);

    return {
      job: queuedJob,
      customerStatus: toCustomerFacingStatus(queuedJob.status),
      isExistingJob: false,
      subscriptionPriorityStatus
    };
  }
}
