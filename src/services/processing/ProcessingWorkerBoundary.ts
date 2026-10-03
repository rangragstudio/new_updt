/**
 * ============================================================================
 * RenderWalk Processing Worker Boundary (Task 34)
 * ============================================================================
 *
 * Implements the decoupled worker boundary:
 *   ProcessingJob -> Queue -> Worker -> AlignmentGraphBuilder -> CameraPoseSolvingService -> Next Task
 *
 * Requirements:
 * - Worker dequeues job and marks RUNNING
 * - Validates input manifest and storage asset access
 * - Runs real image preparation, feature detection, pairwise matching, and RANSAC verification
 * - Solves relative camera poses with graph-based pose optimization and loop closure
 * - Updates real progress stages: PREPARING_IMAGES -> DETECTING_FEATURES -> MATCHING_FRAMES -> BUILDING_ALIGNMENT_GRAPH -> SOLVING_CAMERA_POSES
 * - Stores generated CameraPoseArtifact
 * - Strictly does NOT mark COMPLETED because stitching pipeline is in downstream tasks
 */

import { StorageService } from "../../../packages/storage/src/StorageService";
import { ServerJobQueue } from "./ServerJobQueue";
import { ProcessingJob } from "./ProcessingJobModel";
import { AlignmentGraphBuilder } from "../reconstruction/AlignmentGraphBuilder";
import { CameraPoseSolvingService } from "../reconstruction/CameraPoseSolvingService";
import {
  AlignmentGraphArtifact,
  CameraPoseArtifact
} from "../reconstruction/ReconstructionModels";

export interface WorkerExecutionResult {
  readonly jobId: string;
  readonly workerId: string;
  readonly success: boolean;
  readonly pipelineStatus: string;
  readonly errorMessage?: string;
  readonly attempts: number;
  readonly artifact?: AlignmentGraphArtifact;
  readonly cameraPoseArtifact?: CameraPoseArtifact;
}

export class ProcessingWorkerBoundary {
  private queue: ServerJobQueue;
  private storageService: StorageService;
  private graphBuilder: AlignmentGraphBuilder;
  private poseSolver: CameraPoseSolvingService;
  public readonly workerId: string;

  constructor(
    queue: ServerJobQueue,
    storageService: StorageService,
    workerId = `worker-${process.pid || 1}-${Math.random().toString(36).substring(2, 6)}`,
    graphBuilder?: AlignmentGraphBuilder,
    poseSolver?: CameraPoseSolvingService
  ) {
    this.queue = queue;
    this.storageService = storageService;
    this.workerId = workerId;
    this.graphBuilder = graphBuilder || new AlignmentGraphBuilder(storageService);
    this.poseSolver = poseSolver || new CameraPoseSolvingService();
  }

  /**
   * Fetches the next available job from the queue and executes the image preparation, frame alignment, and camera pose solving stage.
   */
  public async pollAndProcessNextJob(): Promise<WorkerExecutionResult | null> {
    const job = await this.queue.dequeue(this.workerId);
    if (!job) {
      return null;
    }

    return this.processJob(job);
  }

  /**
   * Executes worker validation, preparation, feature detection, alignment graph construction, and relative camera pose solving.
   */
  public async processJob(job: ProcessingJob): Promise<WorkerExecutionResult> {
    const manifest = job.inputManifest;

    // 1. Initial storage validation check
    for (let i = 0; i < manifest.sourceImages.length; i++) {
      const img = manifest.sourceImages[i];
      const identifier = img.capturePointId ? `point ${img.capturePointId}` : `image ${i + 1}`;
      const exists = await this.storageService.exists(img.storageKey);
      if (!exists) {
        await this.queue.updateJob(job.id, (j) => {
          j.status = "FAILED";
          j.errorMessage = `Storage asset missing for ${identifier}: '${img.storageKey}'`;
        });

        return {
          jobId: job.id,
          workerId: this.workerId,
          success: false,
          pipelineStatus: "STORAGE_ASSET_MISSING",
          errorMessage: `Storage asset missing for ${identifier}: '${img.storageKey}'`,
          attempts: job.attempts
        };
      }
    }

    try {
      // 2. Execute Image Preparation, Feature Detection, Pairwise Matching, and Alignment Graph Building
      const graphArtifact = await this.graphBuilder.buildGraph(manifest, async (stage, percent) => {
        await this.queue.updateJob(job.id, (j) => {
          j.progress = percent;
          j.step = stage;
        });
      });

      // 3. Execute Relative Camera Pose Solving
      await this.queue.updateJob(job.id, (j) => {
        j.progress = 95;
        j.step = "SOLVING_CAMERA_POSES";
      });

      const poseArtifact = await this.poseSolver.solveCameraPoses(graphArtifact, job.id);

      if (poseArtifact.status !== "SOLVED") {
        await this.queue.updateJob(job.id, (j) => {
          j.status = "FAILED";
          j.errorMessage = poseArtifact.failureReason || "Camera pose solving failed.";
        });

        return {
          jobId: job.id,
          workerId: this.workerId,
          success: false,
          pipelineStatus: poseArtifact.status,
          errorMessage: poseArtifact.failureReason,
          attempts: job.attempts,
          artifact: graphArtifact,
          cameraPoseArtifact: poseArtifact
        };
      }

      // 4. Truthful boundary: Camera poses solved from alignment graph, awaiting downstream panorama stitching
      await this.queue.updateJob(job.id, (j) => {
        j.progress = 100;
        j.step = "Camera poses solved from alignment graph. Awaiting stitching pipeline.";
      });

      return {
        jobId: job.id,
        workerId: this.workerId,
        success: true,
        pipelineStatus: "CAMERA_POSES_SOLVED",
        attempts: job.attempts,
        artifact: graphArtifact,
        cameraPoseArtifact: poseArtifact
      };
    } catch (err: any) {
      await this.queue.updateJob(job.id, (j) => {
        j.status = "FAILED";
        j.errorMessage = err.message;
      });

      return {
        jobId: job.id,
        workerId: this.workerId,
        success: false,
        pipelineStatus: "PROCESSING_FAILED",
        errorMessage: err.message,
        attempts: job.attempts
      };
    }
  }

  /**
   * Safe retry handler for transient errors.
   */
  public async retryJob(jobId: string): Promise<ProcessingJob> {
    return this.queue.updateJob(jobId, (j) => {
      if (j.attempts >= j.maxAttempts) {
        throw new Error(`Job ${jobId} exceeded maximum attempts (${j.maxAttempts}). Cannot retry.`);
      }
      j.status = "QUEUED";
      j.errorMessage = undefined;
      j.step = "Re-queued for worker retry";
    });
  }
}
