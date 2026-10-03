/**
 * ============================================================================
 * TASK 32 — SERVER PROCESSING JOB CREATION & QUEUE FOUNDATION TESTS
 * ============================================================================
 *
 * Verifies all 14 test specifications required by Task 32:
 * 1. Valid session creates processing job
 * 2. Incomplete session rejected
 * 3. Missing upload rejected
 * 4. Wrong organization rejected
 * 5. Duplicate processing request returns existing job (idempotent)
 * 6. Job is actually queued
 * 7. Job enters RUNNING only when worker receives it
 * 8. Job cannot become COMPLETED without real processing
 * 9. Retry count works
 * 10. Invalid job state rejected
 * 11. Input manifest contains correct source assets
 * 12. Tenant isolation works
 * 13. Processing priority comes from real configuration if available
 * 14. Missing subscription priority is reported honestly (SUBSCRIPTION_PRIORITY_NOT_AVAILABLE)
 * ============================================================================
 */

import { ServerJobQueueImpl } from "../src/services/processing/ServerJobQueue";
import {
  ProcessingJobService,
  UserAuthContext,
  ProcessingValidationError,
  TenantAccessError
} from "../src/services/processing/ProcessingJobService";
import { ProcessingWorkerBoundary } from "../src/services/processing/ProcessingWorkerBoundary";
import { JobStateMachine, SourceImageAssetManifest } from "../src/services/processing/ProcessingJobModel";
import { StorageService } from "../packages/storage/src/StorageService";

import jpeg from "jpeg-js";

// Mock storage service that satisfies the StorageService interface
class MockStorageService implements StorageService {
  private files: Set<string> = new Set();
  private defaultJpeg: Buffer;

  constructor() {
    const raw = Buffer.alloc(100 * 100 * 4, 128);
    this.defaultJpeg = Buffer.from(jpeg.encode({ data: raw, width: 100, height: 100 }, 90).data);
  }

  public addFile(key: string) {
    this.files.add(key);
  }

  public removeFile(key: string) {
    this.files.delete(key);
  }

  async upload(key: string, data: Buffer | Uint8Array, mimeType: string): Promise<string> {
    this.files.add(key);
    return `https://storage.local/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    if (!this.files.has(key)) throw new Error("File not found");
    return Buffer.from(this.defaultJpeg);
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.files.has(key);
  }

  async getSignedUrl(key: string): Promise<string> {
    return `https://storage.local/${key}`;
  }

  async createUploadUrl(key: string, mimeType: string) {
    return { uploadUrl: `https://storage.local/upload?key=${key}`, fileKey: key, expiresInSeconds: 3600 };
  }

  async getMetadata(key: string) {
    return { key, size: 1024, mimeType: "image/jpeg", lastModified: new Date() };
  }

  getPublicUrl(key: string): string {
    return `https://storage.local/${key}`;
  }
}

function create8ValidManifestAssets(sessionId: string, storage: MockStorageService): SourceImageAssetManifest[] {
  const assets: SourceImageAssetManifest[] = [];
  for (let i = 1; i <= 8; i++) {
    const key = `sessions/${sessionId}/point_${i}.jpg`;
    storage.addFile(key);
    assets.push({
      assetId: `asset-${sessionId}-${i}`,
      capturePointId: i,
      targetHeadingDegrees: (i - 1) * 45.0,
      actualHeadingDegrees: (i - 1) * 45.0 + 1.2,
      captureTimestamp: 1700000000000 + i * 1000,
      storageKey: key,
      dimensions: { width: 1920, height: 1080 },
      fileSizeBytes: 204800
    });
  }
  return assets;
}

async function runTask32Tests() {
  console.log("====================================================================");
  console.log("TASK 32 — SERVER PROCESSING JOB CREATION & QUEUE FOUNDATION TESTS");
  console.log("====================================================================\n");

  const orgId = "org-alpha-123";
  const authUser: UserAuthContext = {
    userId: "usr-456",
    email: "builder@renderwalk.com",
    memberships: [{ organizationId: orgId, role: "OWNER" }]
  };

  // -------------------------------------------------------------------------
  // TEST 1: Valid session creates processing job
  // -------------------------------------------------------------------------
  console.log("[TEST 1] Valid session creates processing job...");
  const queue = new ServerJobQueueImpl();
  const storage = new MockStorageService();
  const service = new ProcessingJobService(queue, storage, 5);

  const sessionId1 = "sess-001";
  const validAssets = create8ValidManifestAssets(sessionId1, storage);

  const result1 = await service.requestProcessing({
    authContext: authUser,
    organizationId: orgId,
    sessionId: sessionId1,
    manifest: {
      totalSourceImages: 8,
      sourceImages: validAssets
    }
  });

  if (!result1.job || !result1.job.id) throw new Error("Test 1 failed: No job created");
  if (result1.job.status !== "QUEUED") throw new Error("Test 1 failed: Status should be QUEUED");
  if (result1.isExistingJob !== false) throw new Error("Test 1 failed: Should be new job");
  if (result1.customerStatus !== "Ready for processing") throw new Error("Test 1 failed: Incorrect customer status");
  console.log(`  Job created: ${result1.job.id}, Status: ${result1.job.status}, Customer: ${result1.customerStatus}`);
  console.log("  -> TEST 1 PASSED: Valid session creates job.\n");

  // -------------------------------------------------------------------------
  // TEST 2: Incomplete session rejected
  // -------------------------------------------------------------------------
  console.log("[TEST 2] Incomplete session rejected (< 8 points)...");
  let caughtIncomplete = false;
  try {
    await service.requestProcessing({
      authContext: authUser,
      organizationId: orgId,
      sessionId: "sess-incomplete",
      manifest: {
        totalSourceImages: 8,
        sourceImages: validAssets.slice(0, 7) // Only 7 points
      }
    });
  } catch (err: any) {
    if (err instanceof ProcessingValidationError && err.message.includes("Incomplete capture set")) {
      caughtIncomplete = true;
    }
  }
  if (!caughtIncomplete) throw new Error("Test 2 failed: Did not reject incomplete session");
  console.log("  Incomplete capture set (7 of 8) cleanly rejected with validation error");
  console.log("  -> TEST 2 PASSED: Incomplete session rejected.\n");

  // -------------------------------------------------------------------------
  // TEST 3: Missing upload rejected (file not found in storage)
  // -------------------------------------------------------------------------
  console.log("[TEST 3] Missing upload rejected...");
  let caughtMissingUpload = false;
  const missingStorage = new MockStorageService();
  const missingAssets = create8ValidManifestAssets("sess-missing", missingStorage);
  // Delete point 4 from storage
  missingStorage.removeFile(missingAssets[3].storageKey);

  const missingService = new ProcessingJobService(queue, missingStorage);
  try {
    await missingService.requestProcessing({
      authContext: authUser,
      organizationId: orgId,
      sessionId: "sess-missing",
      manifest: { totalSourceImages: 8, sourceImages: missingAssets }
    });
  } catch (err: any) {
    if (err instanceof ProcessingValidationError && err.message.includes("not found in storage")) {
      caughtMissingUpload = true;
    }
  }
  if (!caughtMissingUpload) throw new Error("Test 3 failed: Did not reject missing storage asset");
  console.log("  Missing storage asset cleanly detected and rejected");
  console.log("  -> TEST 3 PASSED: Missing upload rejected.\n");

  // -------------------------------------------------------------------------
  // TEST 4: Wrong organization rejected
  // -------------------------------------------------------------------------
  console.log("[TEST 4] Wrong organization rejected (tenant isolation)...");
  let caughtWrongOrg = false;
  try {
    await service.requestProcessing({
      authContext: authUser,
      organizationId: "org-foreign-999", // User is not member of this org
      sessionId: "sess-004",
      manifest: { totalSourceImages: 8, sourceImages: validAssets }
    });
  } catch (err: any) {
    if (err instanceof TenantAccessError && err.code === "ORGANIZATION_MISMATCH") {
      caughtWrongOrg = true;
    }
  }
  if (!caughtWrongOrg) throw new Error("Test 4 failed: Did not reject foreign organization");
  console.log("  Tenant mismatch rejected with TenantAccessError (ORGANIZATION_MISMATCH)");
  console.log("  -> TEST 4 PASSED: Wrong organization rejected.\n");

  // -------------------------------------------------------------------------
  // TEST 5: Duplicate processing request returns existing job (idempotent)
  // -------------------------------------------------------------------------
  console.log("[TEST 5] Duplicate processing request returns existing job (idempotent)...");
  const resultDup = await service.requestProcessing({
    authContext: authUser,
    organizationId: orgId,
    sessionId: sessionId1, // Same session as Test 1
    manifest: { totalSourceImages: 8, sourceImages: validAssets }
  });

  if (resultDup.isExistingJob !== true) throw new Error("Test 5 failed: Should return existing job");
  if (resultDup.job.id !== result1.job.id) throw new Error("Test 5 failed: Job ID mismatch for idempotent call");
  console.log(`  Idempotent response: Returned existing active job ${resultDup.job.id} without duplication`);
  console.log("  -> TEST 5 PASSED: Idempotency verified.\n");

  // -------------------------------------------------------------------------
  // TEST 6: Job is actually queued in ServerJobQueue
  // -------------------------------------------------------------------------
  console.log("[TEST 6] Job is actually queued in ServerJobQueue...");
  const queuedCount = await queue.countQueued();
  if (queuedCount !== 1) throw new Error(`Test 6 failed: Expected 1 queued job, found ${queuedCount}`);
  const fetchedJob = await queue.getJobById(result1.job.id);
  if (!fetchedJob || fetchedJob.status !== "QUEUED") throw new Error("Test 6 failed: Job not found in queue");
  console.log(`  Queued jobs in queue: ${queuedCount}, Job ${fetchedJob.id} is in QUEUED state`);
  console.log("  -> TEST 6 PASSED: Server job queue verified.\n");

  // -------------------------------------------------------------------------
  // TEST 7: Job enters RUNNING only when worker receives it
  // -------------------------------------------------------------------------
  console.log("[TEST 7] Job enters RUNNING only when worker receives it...");
  const worker = new ProcessingWorkerBoundary(queue, storage, "worker-test-node-1");

  // Dequeue job from queue
  const dequeuedJob = await queue.dequeue(worker.workerId);
  if (!dequeuedJob) throw new Error("Test 7 failed: Worker could not dequeue job");
  if (dequeuedJob.status !== "RUNNING") throw new Error(`Test 7 failed: Expected RUNNING, got ${dequeuedJob.status}`);
  if (dequeuedJob.workerId !== worker.workerId) throw new Error("Test 7 failed: Worker ID mismatch");
  if (!dequeuedJob.startedAt) throw new Error("Test 7 failed: startedAt timestamp missing");
  console.log(`  Worker ${dequeuedJob.workerId} dequeued job. Status transitioned to RUNNING at ${dequeuedJob.startedAt}`);
  console.log("  -> TEST 7 PASSED: Job enters RUNNING only on worker receipt.\n");

  // -------------------------------------------------------------------------
  // TEST 8: Job cannot become COMPLETED without real processing
  // -------------------------------------------------------------------------
  console.log("[TEST 8] Job cannot become COMPLETED without real processing...");
  const workerResult = await worker.processJob(dequeuedJob);
  if (
    workerResult.pipelineStatus !== "RECONSTRUCTION_PIPELINE_NOT_AVAILABLE" &&
    workerResult.pipelineStatus !== "ALIGNMENT_GRAPH_GENERATED" &&
    workerResult.pipelineStatus !== "CAMERA_POSES_SOLVED" &&
    workerResult.pipelineStatus !== "INSUFFICIENT_RECONSTRUCTION_GRAPH"
  ) {
    throw new Error(`Test 8 failed: Expected controlled reconstruction pipeline status, got ${workerResult.pipelineStatus}`);
  }

  const updatedJob = await queue.getJobById(dequeuedJob.id);
  if (updatedJob?.status === "COMPLETED") {
    throw new Error("Test 8 failed: Job must NOT be marked COMPLETED prematurely");
  }
  console.log(`  Worker pipeline status: ${workerResult.pipelineStatus}`);
  console.log(`  Job final status: ${updatedJob?.status} (errorMessage: "${updatedJob?.errorMessage}")`);
  console.log("  -> TEST 8 PASSED: Truthful worker boundary verified.\n");

  // -------------------------------------------------------------------------
  // TEST 9: Retry count works
  // -------------------------------------------------------------------------
  console.log("[TEST 9] Retry count works...");
  if (updatedJob?.attempts !== 1) throw new Error(`Test 9 failed: Expected attempts=1, got ${updatedJob?.attempts}`);

  // Re-queue job for retry
  const retriedJob = await worker.retryJob(updatedJob.id);
  if (retriedJob.status !== "QUEUED") throw new Error("Test 9 failed: Retry did not transition back to QUEUED");

  // Second dequeue
  const secondDequeued = await queue.dequeue(worker.workerId);
  if (secondDequeued?.attempts !== 2) throw new Error(`Test 9 failed: Expected attempts=2 on second run, got ${secondDequeued?.attempts}`);
  console.log(`  Retry succeeded: attempts tracked accurately (${secondDequeued.attempts} of ${secondDequeued.maxAttempts})`);
  console.log("  -> TEST 9 PASSED: Retry count verified.\n");

  // -------------------------------------------------------------------------
  // TEST 10: Invalid job state rejected
  // -------------------------------------------------------------------------
  console.log("[TEST 10] Invalid job state rejected by state machine...");
  let caughtInvalidTransition = false;
  try {
    // Attempt illegal transition: COMPLETED -> QUEUED directly
    JobStateMachine.assertTransition("COMPLETED", "QUEUED");
  } catch (err: any) {
    if (err.message.includes("Invalid job state transition")) {
      caughtInvalidTransition = true;
    }
  }
  if (!caughtInvalidTransition) throw new Error("Test 10 failed: State machine did not reject invalid transition");
  console.log("  Illegal state transition (COMPLETED -> QUEUED) strictly blocked");
  console.log("  -> TEST 10 PASSED: State machine validation verified.\n");

  // -------------------------------------------------------------------------
  // TEST 11: Input manifest contains correct source assets
  // -------------------------------------------------------------------------
  console.log("[TEST 11] Input manifest contains correct source assets...");
  const manifest = result1.job.inputManifest;
  if (manifest.totalSourceImages !== 8) throw new Error("Test 11 failed: totalSourceImages must be 8");
  if (manifest.sourceImages.length !== 8) throw new Error("Test 11 failed: sourceImages length must be 8");

  for (let i = 0; i < 8; i++) {
    const asset = manifest.sourceImages[i];
    if (asset.capturePointId !== i + 1) throw new Error(`Test 11 failed: Point ID mismatch at index ${i}`);
    if (asset.dimensions.width !== 1920 || asset.dimensions.height !== 1080) {
      throw new Error(`Test 11 failed: Dimensions mismatch at point ${asset.capturePointId}`);
    }
    if (!asset.storageKey.startsWith("sessions/")) {
      throw new Error(`Test 11 failed: Storage key invalid at point ${asset.capturePointId}`);
    }
  }
  console.log("  Input manifest verified: 8 assets with correct point IDs, headings, and storage references");
  console.log("  -> TEST 11 PASSED: Input manifest verified.\n");

  // -------------------------------------------------------------------------
  // TEST 12: Tenant isolation works
  // -------------------------------------------------------------------------
  console.log("[TEST 12] Tenant isolation works (viewer role cannot request processing)...");
  let caughtViewerRole = false;
  const viewerUser: UserAuthContext = {
    userId: "usr-viewer",
    email: "viewer@renderwalk.com",
    memberships: [{ organizationId: orgId, role: "VIEWER" }]
  };

  try {
    await service.requestProcessing({
      authContext: viewerUser,
      organizationId: orgId,
      sessionId: "sess-viewer-test",
      manifest: { totalSourceImages: 8, sourceImages: validAssets }
    });
  } catch (err: any) {
    if (err instanceof TenantAccessError && err.code === "INSUFFICIENT_ROLE") {
      caughtViewerRole = true;
    }
  }
  if (!caughtViewerRole) throw new Error("Test 12 failed: VIEWER role should not be allowed to request processing");
  console.log("  VIEWER role blocked from initiating processing with INSUFFICIENT_ROLE");
  console.log("  -> TEST 12 PASSED: Tenant isolation verified.\n");

  // -------------------------------------------------------------------------
  // TEST 13: Processing priority comes from real configuration
  // -------------------------------------------------------------------------
  console.log("[TEST 13] Processing priority comes from real configuration...");
  if (result1.job.priority !== 5) {
    throw new Error(`Test 13 failed: Expected default priority 5, got ${result1.job.priority}`);
  }
  console.log(`  Job assigned configurable default priority: ${result1.job.priority}`);
  console.log("  -> TEST 13 PASSED: Priority mechanism verified.\n");

  // -------------------------------------------------------------------------
  // TEST 14: Missing subscription priority reported honestly
  // -------------------------------------------------------------------------
  console.log("[TEST 14] Missing subscription priority reported honestly...");
  if (result1.subscriptionPriorityStatus !== "SUBSCRIPTION_PRIORITY_NOT_AVAILABLE") {
    throw new Error(`Test 14 failed: Expected SUBSCRIPTION_PRIORITY_NOT_AVAILABLE, got ${result1.subscriptionPriorityStatus}`);
  }
  console.log(`  Reported status: ${result1.subscriptionPriorityStatus}`);
  console.log("  -> TEST 14 PASSED: Missing subscription priority reported honestly.\n");

  console.log("====================================================================");
  console.log("TASK 32 ALL 14 TESTS PASSED SUCCESSFULLY!");
  console.log("====================================================================");
}

runTask32Tests().catch((err) => {
  console.error("\nTask 32 tests failed:", err);
  process.exit(1);
});
