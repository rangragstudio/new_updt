/**
 * ============================================================================
 * RenderWalk Processing Event Boundary (Task 32)
 * ============================================================================
 *
 * Provides a clean event-driven interface for state transitions.
 * Notification and audit listeners can subscribe without sending premature emails.
 */

import { ProcessingJob, JobStatus } from "./ProcessingJobModel";

export type ProcessingEventType =
  | "PROCESSING_QUEUED"
  | "PROCESSING_STARTED"
  | "PROCESSING_COMPLETED"
  | "PROCESSING_FAILED"
  | "PROCESSING_CANCELLED";

export interface ProcessingEvent {
  readonly type: ProcessingEventType;
  readonly jobId: string;
  readonly organizationId: string;
  readonly sessionId: string;
  readonly status: JobStatus;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
}

export type ProcessingEventListener = (event: ProcessingEvent) => void | Promise<void>;

export class ProcessingEventBus {
  private static listeners: Set<ProcessingEventListener> = new Set();

  public static subscribe(listener: ProcessingEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public static emit(type: ProcessingEventType, job: ProcessingJob, metadata?: Record<string, unknown>): void {
    const event: ProcessingEvent = {
      type,
      jobId: job.id,
      organizationId: job.organizationId,
      sessionId: job.sessionId,
      status: job.status,
      timestamp: new Date().toISOString(),
      metadata
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`Error in processing event listener for ${type}:`, err);
      }
    }
  }

  public static clearListeners(): void {
    this.listeners.clear();
  }
}
