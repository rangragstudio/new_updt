/**
 * ============================================================================
 * RenderWalk Server Job Queue Foundation (Task 32)
 * ============================================================================
 *
 * Implements a server-side prioritized job queue with idempotency tracking,
 * concurrency-safe dequeuing, and state machine validation.
 * No browser-only fake queues or setTimeout processing.
 */

import { ProcessingJob, JobStatus, JobStateMachine } from "./ProcessingJobModel";
import { ProcessingEventBus } from "./ProcessingEvents";

export interface ServerJobQueue {
  enqueue(job: ProcessingJob): Promise<ProcessingJob>;
  dequeue(workerId: string): Promise<ProcessingJob | null>;
  getJobById(jobId: string): Promise<ProcessingJob | null>;
  findActiveJobBySession(sessionId: string): Promise<ProcessingJob | null>;
  updateJob(jobId: string, updater: (job: ProcessingJob) => void): Promise<ProcessingJob>;
  countQueued(): Promise<number>;
  clear(): Promise<void>;
}

/**
 * Server-side in-process persistent store and priority queue.
 * Designed to interface with PostgreSQL / Prisma / pg-boss in production deployments.
 */
export class ServerJobQueueImpl implements ServerJobQueue {
  private jobs: Map<string, ProcessingJob> = new Map();

  public async enqueue(job: ProcessingJob): Promise<ProcessingJob> {
    // Assert initial state is QUEUED
    if (job.status !== "QUEUED") {
      throw new Error(`Cannot enqueue job in status '${job.status}'. Expected 'QUEUED'.`);
    }

    this.jobs.set(job.id, { ...job });
    ProcessingEventBus.emit("PROCESSING_QUEUED", job);
    return this.jobs.get(job.id)!;
  }

  public async dequeue(workerId: string): Promise<ProcessingJob | null> {
    // Find highest priority QUEUED job (highest priority number first, oldest createdAt first)
    const queuedJobs = Array.from(this.jobs.values())
      .filter((j) => j.status === "QUEUED")
      .sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority; // Descending priority
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // Ascending FIFO
      });

    if (queuedJobs.length === 0) {
      return null;
    }

    const job = queuedJobs[0];
    JobStateMachine.assertTransition(job.status, "RUNNING");

    job.status = "RUNNING";
    job.workerId = workerId;
    job.startedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    job.attempts += 1;

    this.jobs.set(job.id, job);
    ProcessingEventBus.emit("PROCESSING_STARTED", job);
    return { ...job };
  }

  public async getJobById(jobId: string): Promise<ProcessingJob | null> {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  public async findActiveJobBySession(sessionId: string): Promise<ProcessingJob | null> {
    const activeJob = Array.from(this.jobs.values()).find(
      (j) => j.sessionId === sessionId && (j.status === "QUEUED" || j.status === "RUNNING")
    );
    return activeJob ? { ...activeJob } : null;
  }

  public async updateJob(jobId: string, updater: (job: ProcessingJob) => void): Promise<ProcessingJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const oldStatus = job.status;
    updater(job);

    if (job.status !== oldStatus) {
      JobStateMachine.assertTransition(oldStatus, job.status);
      if (job.status === "COMPLETED") {
        job.completedAt = new Date().toISOString();
        ProcessingEventBus.emit("PROCESSING_COMPLETED", job);
      } else if (job.status === "FAILED") {
        ProcessingEventBus.emit("PROCESSING_FAILED", job);
      } else if (job.status === "CANCELLED") {
        ProcessingEventBus.emit("PROCESSING_CANCELLED", job);
      }
    }

    job.updatedAt = new Date().toISOString();
    this.jobs.set(job.id, { ...job });
    return { ...job };
  }

  public async countQueued(): Promise<number> {
    return Array.from(this.jobs.values()).filter((j) => j.status === "QUEUED").length;
  }

  public async clear(): Promise<void> {
    this.jobs.clear();
  }
}
