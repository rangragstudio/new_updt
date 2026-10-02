import { StorageService } from "../../../packages/storage/src/StorageService";
import { TilingPipeline, PanoramaProcessingResult } from "./tilingPipeline";

export type JobStatusType = "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "NEEDS_ATTENTION";

export interface ProcessingJobRecord {
  id: string;
  organizationId: string;
  tourId?: string;
  type: string; // "PANORAMA_PROCESS" | "MAKE_PREVIEW" | "GENERATE_TILES" | "RENDER_PACKAGE_IMPORT"
  targetId?: string; // scanId or tourId
  status: JobStatusType;
  progress: number;
  step: string;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  workerId?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class JobProcessor {
  private tilingPipeline: TilingPipeline;
  private storageService: StorageService;
  private jobs: Map<string, ProcessingJobRecord> = new Map();
  private workerId: string;

  constructor(storageService: StorageService, workerId = `worker-${process.pid || 1}`) {
    this.storageService = storageService;
    this.tilingPipeline = new TilingPipeline();
    this.workerId = workerId;
  }

  createJob(params: {
    organizationId: string;
    tourId?: string;
    type: string;
    targetId?: string;
  }): ProcessingJobRecord {
    const now = new Date().toISOString();
    const job: ProcessingJobRecord = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      organizationId: params.organizationId,
      tourId: params.tourId,
      type: params.type,
      targetId: params.targetId,
      status: "QUEUED",
      progress: 0,
      step: "Queued for worker execution",
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.id, job);
    return job;
  }

  getJob(jobId: string): ProcessingJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): ProcessingJobRecord[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Process a panorama job end-to-end
   */
  async executePanoramaJob(
    jobId: string,
    sourceBuffer: Buffer
  ): Promise<PanoramaProcessingResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = "RUNNING";
    job.workerId = this.workerId;
    job.startedAt = new Date().toISOString();
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();

    try {
      const result = await this.tilingPipeline.processPanorama({
        sourceBuffer,
        organizationId: job.organizationId,
        tourId: job.tourId || "unassigned",
        scanId: job.targetId || "scan-0",
        storageService: this.storageService,
        onProgress: async (progress: number, step: string) => {
          job.progress = progress;
          job.step = step;
          job.updatedAt = new Date().toISOString();
        }
      });

      job.status = "DONE";
      job.progress = 100;
      job.step = "Complete. Multi-resolution tiles and manifest ready.";
      job.completedAt = new Date().toISOString();
      job.updatedAt = new Date().toISOString();
      return result;
    } catch (err: any) {
      job.status = "FAILED";
      job.errorMessage = err.message || "Unknown error during panorama processing";
      job.step = `Failed: ${job.errorMessage}`;
      job.updatedAt = new Date().toISOString();
      throw err;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string, sourceBuffer?: Buffer): Promise<ProcessingJobRecord> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== "FAILED") {
      throw new Error(`Job ${jobId} is not in FAILED state (current: ${job.status}).`);
    }

    if (job.attempts >= job.maxAttempts) {
      job.status = "NEEDS_ATTENTION";
      job.errorMessage = `Job exceeded max attempts (${job.maxAttempts}). Requires manual inspection.`;
      job.step = "Exceeded max retry attempts. Moved to dead-letter queue.";
      job.updatedAt = new Date().toISOString();
      return job;
    }

    job.status = "QUEUED";
    job.errorMessage = undefined;
    job.progress = 0;
    job.step = "Queued for retry";
    job.updatedAt = new Date().toISOString();

    if (sourceBuffer) {
      // Re-run execution
      await this.executePanoramaJob(jobId, sourceBuffer);
    }

    return job;
  }
}
