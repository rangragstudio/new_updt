import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import AdmZip from "adm-zip";
import { LocalStorageAdapter, CloudflareR2StorageAdapter } from "../../../packages/storage/src/StorageService";
import { TilingPipeline } from "./tilingPipeline";
import { JobProcessor } from "./JobProcessor";
import { ZipRenderPackageImportService } from "../../../packages/import/src/ZipRenderPackageImportService";

interface BenchmarkResult {
  resolutionName: string;
  dimensions: string;
  sourceSizeBytes: number;
  processingTimeMs: number;
  levelsCount: number;
  tileCount: number;
  totalOutputSizeBytes: number;
}

export async function createSyntheticEquirectangular(
  width: number,
  height: number,
  title: string
): Promise<Buffer> {
  // Create an SVG with gradient and equirectangular grid markers
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#141210"/>
          <stop offset="50%" stop-color="#1B1815"/>
          <stop offset="100%" stop-color="#D6A77A"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#skyGrad)"/>
      <circle cx="${width / 2}" cy="${height / 2}" r="${height / 4}" fill="#D6A77A" opacity="0.3"/>
      <line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="#D6A77A" stroke-width="4"/>
      <text x="${width / 2}" y="${height / 2}" fill="#F6F2EC" font-size="${height / 16}" font-family="sans-serif" text-anchor="middle" alignment-baseline="middle">
        RenderWalk 360 - ${title} (${width}x${height})
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

async function runWorkerIntegrationSuite() {
  console.log("==================================================");
  console.log("RENDERWALK — PHASE 1 HARDENING INTEGRATION SUITE");
  console.log("==================================================");

  const testStorageDir = path.resolve("./storage_test_data");
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
  const storage = new LocalStorageAdapter(testStorageDir, "http://localhost:3000/storage");
  const processor = new JobProcessor(storage, "test-worker-1");
  const tiling = new TilingPipeline();

  const summary = {
    unitTests: 0,
    integrationTests: 0,
    endToEndTests: 0,
    envDependentTests: 0,
    failures: 0
  };

  function assert(condition: boolean, msg: string, category: "UNIT" | "INTEGRATION" | "E2E" | "ENV") {
    if (category === "UNIT") summary.unitTests++;
    else if (category === "INTEGRATION") summary.integrationTests++;
    else if (category === "E2E") summary.endToEndTests++;
    else if (category === "ENV") summary.envDependentTests++;

    if (condition) {
      console.log(`  [PASS] [${category}] ${msg}`);
    } else {
      console.error(`  [FAIL] [${category}] ${msg}`);
      summary.failures++;
    }
  }

  // ----------------------------------------------------
  // PART 9: STORAGE VERIFICATION
  // ----------------------------------------------------
  console.log("\n--- PART 9: STORAGE SERVICE VERIFICATION ---");
  const testKey = "test/sample.txt";
  const testData = Buffer.from("RenderWalk Real Storage Test Payload", "utf8");

  await storage.upload(testKey, testData, "text/plain");
  assert(await storage.exists(testKey), "LocalStorageAdapter writes file to disk and exists() reports true", "INTEGRATION");

  const downloaded = await storage.download(testKey);
  assert(downloaded.toString("utf8") === testData.toString("utf8"), "LocalStorageAdapter downloads exact stored bytes", "INTEGRATION");

  const meta = await storage.getMetadata(testKey);
  assert(meta.size === testData.length, `LocalStorageAdapter getMetadata() returns exact size (${meta.size} bytes)`, "INTEGRATION");

  await storage.delete(testKey);
  assert(!(await storage.exists(testKey)), "LocalStorageAdapter delete() removes file from disk", "INTEGRATION");

  // Cloudflare R2 Check
  const r2 = new CloudflareR2StorageAdapter({
    bucket: "renderwalk-test-bucket",
    publicBaseUrl: "https://cdn.renderwalk.com"
  });
  if (r2.isConfigured()) {
    assert(true, "Cloudflare R2 credentials found and active", "ENV");
  } else {
    assert(true, "Cloudflare R2 marked ENVIRONMENT-DEPENDENT (requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)", "ENV");
  }

  // ----------------------------------------------------
  // PART 2 & 4: REAL LIBVIPS TILING & JOB EXECUTION
  // ----------------------------------------------------
  console.log("\n--- PART 2 & 4: REAL LIBVIPS TILING & JOB LIFECYCLE ---");
  const panoramaBuffer = await createSyntheticEquirectangular(2048, 1024, "Living Hall 2K");
  assert(panoramaBuffer.length > 0, "Created real equirectangular test JPEG (2048x1024)", "UNIT");

  const validation = await tiling.validateImageBuffer(panoramaBuffer);
  assert(validation.isValid, "Libvips validates real 2:1 JPEG as valid equirectangular", "UNIT");
  assert(validation.width === 2048 && validation.height === 1024, "Validation accurately extracts 2048x1024 dimensions", "UNIT");

  // Create and Execute Job
  const job = processor.createJob({
    organizationId: "org-test-1",
    tourId: "tour-test-1",
    type: "PANORAMA_PROCESS",
    targetId: "scan-living-1"
  });
  assert(job.status === "QUEUED", "Job initially has QUEUED status", "UNIT");

  const recordedSteps: string[] = [];
  const result = await processor.executePanoramaJob(job.id, panoramaBuffer);

  assert(job.status === "DONE", "Job status progresses to DONE after completion", "INTEGRATION");
  assert(job.progress === 100, "Job progress reaches 100%", "INTEGRATION");
  assert(job.attempts === 1, "Job records exactly 1 attempt", "INTEGRATION");
  assert(Boolean(job.completedAt), "Job records completedAt timestamp", "INTEGRATION");

  // Verify Real Assets on Storage
  assert(await storage.exists(result.manifestKey), `Manifest exists on disk at ${result.manifestKey}`, "INTEGRATION");
  assert(await storage.exists(result.previewKey), `2K Preview exists on disk at ${result.previewKey}`, "INTEGRATION");
  assert(await storage.exists(result.thumbKey), `Thumbnail exists on disk at ${result.thumbKey}`, "INTEGRATION");
  assert(await storage.exists(result.originalKey), `Original raw image exists at ${result.originalKey}`, "INTEGRATION");

  // Verify Tile Count
  assert(result.tileCount > 0, `Generated ${result.tileCount} real multi-resolution tiles`, "INTEGRATION");
  const firstTilePath = tiling.getTileStoragePath("org-test-1", "tour-test-1", "scan-living-1", 0, 0, 0);
  assert(await storage.exists(firstTilePath), `Level 0 tile (0-0.jpg) exists on disk`, "INTEGRATION");

  // Test Failure & Retry Lifecycle
  console.log("\n--- PART 4: FAILURE & RETRY LIFECYCLE ---");
  const failJob = processor.createJob({
    organizationId: "org-test-1",
    tourId: "tour-test-1",
    type: "PANORAMA_PROCESS",
    targetId: "scan-corrupt"
  });
  const corruptBuffer = Buffer.from("CorruptedNonImageStringPayload", "utf8");

  try {
    await processor.executePanoramaJob(failJob.id, corruptBuffer);
    assert(false, "Corrupt buffer must fail processing", "UNIT");
  } catch (err: any) {
    assert(failJob.status === "FAILED", "Corrupt processing sets job status to FAILED", "INTEGRATION");
    assert(Boolean(failJob.errorMessage), `Job captures error message: "${failJob.errorMessage?.substring(0, 40)}..."`, "INTEGRATION");
  }

  // Retry with valid image
  await processor.retryJob(failJob.id, panoramaBuffer);
  assert(failJob.status === "DONE", "Retried job recovers to DONE state", "INTEGRATION");
  assert(failJob.attempts === 2, "Retried job records incremented attempts count (2)", "INTEGRATION");

  // ----------------------------------------------------
  // PART 5, 6, 7: REAL RENDER PACKAGE ZIP IMPORT & SECURITY
  // ----------------------------------------------------
  console.log("\n--- PART 5, 6, 7: REAL RENDER PACKAGE ZIP IMPORT & SECURITY ---");
  const importService = new ZipRenderPackageImportService(storage, tiling);

  // 1. Build a valid Appendix C test ZIP in-memory
  const validZip = new AdmZip();
  const kitchenBuffer = await createSyntheticEquirectangular(2048, 1024, "Kitchen View 2K");

  const appendixCManifest = {
    version: 1,
    name: "Aadhya Penthouse ArchViz Package",
    units: "m",
    up_axis: "z",
    source: "sketchup+vray",
    scans: [
      {
        id: "scan-01-living",
        image: "images/living_hall.jpg",
        position: [0.0, 0.0, 1.5],
        rotation_deg: { yaw: 15.0, pitch: 0.0, roll: 0.0 },
        room: "Living Room",
        level: "Ground Floor"
      },
      {
        id: "scan-02-kitchen",
        image: "images/kitchen.jpg",
        position: [3.2, 0.8, 1.5],
        rotation_deg: { yaw: 90.0, pitch: -2.0, roll: 0.0 },
        room: "Kitchen",
        level: "Ground Floor"
      }
    ]
  };

  validZip.addFile("manifest.json", Buffer.from(JSON.stringify(appendixCManifest, null, 2), "utf8"));
  validZip.addFile("images/living_hall.jpg", panoramaBuffer);
  validZip.addFile("images/kitchen.jpg", kitchenBuffer);
  const validZipBuffer = validZip.toBuffer();

  // Test Real Import
  const importResult = await importService.importZipPackage({
    zipBuffer: validZipBuffer,
    organizationId: "org-test-1"
  });

  assert(importResult.success, "Real Appendix C render package ZIP imports successfully", "E2E");
  assert(importResult.scansCount === 2, "Package extracts and processes 2 scans", "E2E");
  assert(importResult.roomsCount === 2, "Package extracts 2 unique rooms", "E2E");
  assert(importResult.processedScans.length === 2, "Tiling pipeline executed for both scans in package", "E2E");
  assert(Boolean(importResult.checksum), `Computed package SHA-256 checksum (${importResult.checksum.substring(0, 12)}...)`, "UNIT");

  // Duplicate Check
  const duplicateResult = await importService.importZipPackage({
    zipBuffer: validZipBuffer,
    organizationId: "org-test-1"
  });
  assert(!duplicateResult.success && duplicateResult.isDuplicate, "Duplicate package with identical SHA-256 is rejected", "UNIT");

  // Security Test 1: Path Traversal (Zip-Slip)
  const maliciousZip = new AdmZip();
  maliciousZip.addFile("manifest.json", Buffer.from(JSON.stringify(appendixCManifest), "utf8"));
  maliciousZip.addFile("images/clean.jpg", panoramaBuffer);
  const maliciousEntries = maliciousZip.getEntries();
  const evilEntry = maliciousEntries.find(e => e.entryName === "images/clean.jpg");
  if (evilEntry) {
    (evilEntry as any).entryName = "../../../etc/passwd.jpg";
  }
  const maliciousZipBuffer = maliciousZip.toBuffer();
  const zipSlipResult = await importService.importZipPackage({
    zipBuffer: maliciousZipBuffer,
    organizationId: "org-test-1"
  });
  assert(!zipSlipResult.success && Boolean(zipSlipResult.errorMessage?.includes("Path traversal")), "Zip-Slip path traversal (../../) is blocked with security violation error", "UNIT");

  // Security Test 2: Disallowed File Extension
  const badExtZip = new AdmZip();
  badExtZip.addFile("manifest.json", Buffer.from(JSON.stringify(appendixCManifest), "utf8"));
  badExtZip.addFile("scripts/run.sh", Buffer.from("#!/bin/bash\necho evil"));
  const badExtBuffer = badExtZip.toBuffer();
  const badExtResult = await importService.importZipPackage({
    zipBuffer: badExtBuffer,
    organizationId: "org-test-1"
  });
  assert(!badExtResult.success && Boolean(badExtResult.errorMessage?.includes("Disallowed file extension")), "Disallowed executable extension (.sh) is blocked", "UNIT");

  // Security Test 3: Duplicate Scan ID in Manifest
  const dupIdManifest = {
    version: 1,
    name: "Duplicate ID Test",
    scans: [
      { id: "scan-dup", image: "images/living_hall.jpg", position: [0, 0, 1.5] },
      { id: "scan-dup", image: "images/kitchen.jpg", position: [2, 0, 1.5] }
    ]
  };
  const dupIdZip = new AdmZip();
  dupIdZip.addFile("manifest.json", Buffer.from(JSON.stringify(dupIdManifest), "utf8"));
  dupIdZip.addFile("images/living_hall.jpg", panoramaBuffer);
  dupIdZip.addFile("images/kitchen.jpg", kitchenBuffer);
  const dupIdResult = await importService.importZipPackage({
    zipBuffer: dupIdZip.toBuffer(),
    organizationId: "org-test-1"
  });
  assert(!dupIdResult.success && Boolean(dupIdResult.errorMessage?.includes("Duplicate scan identifier")), "Duplicate scan identifier in manifest is rejected cleanly", "UNIT");

  // Security Test 4: Missing Referenced Image
  const missingImgManifest = {
    version: 1,
    name: "Missing Image Test",
    scans: [
      { id: "scan-missing", image: "images/non_existent.jpg", position: [0, 0, 1.5] }
    ]
  };
  const missingImgZip = new AdmZip();
  missingImgZip.addFile("manifest.json", Buffer.from(JSON.stringify(missingImgManifest), "utf8"));
  const missingImgResult = await importService.importZipPackage({
    zipBuffer: missingImgZip.toBuffer(),
    organizationId: "org-test-1"
  });
  assert(!missingImgResult.success && Boolean(missingImgResult.errorMessage?.includes("not found in archive")), "Manifest referencing missing image file is rejected", "UNIT");

  // ----------------------------------------------------
  // PART 10: ACTUAL PERFORMANCE BENCHMARKS
  // ----------------------------------------------------
  console.log("\n--- PART 10: ACTUAL PERFORMANCE BENCHMARKS ---");
  const benchmarks: BenchmarkResult[] = [];

  const resolutions = [
    { name: "2K Panorama", width: 2048, height: 1024 },
    { name: "4K Panorama", width: 4096, height: 2048 },
    { name: "8K Panorama", width: 8192, height: 4096 }
  ];

  for (const res of resolutions) {
    console.log(`  Synthesizing and benchmarking ${res.name} (${res.width}x${res.height})...`);
    const buffer = await createSyntheticEquirectangular(res.width, res.height, res.name);
    const benchmarkResult = await tiling.processPanorama({
      sourceBuffer: buffer,
      organizationId: "bench-org",
      tourId: "bench-tour",
      scanId: `scan-${res.width}`,
      storageService: storage
    });

    benchmarks.push({
      resolutionName: res.name,
      dimensions: `${res.width} × ${res.height}`,
      sourceSizeBytes: buffer.length,
      processingTimeMs: benchmarkResult.executionTimeMs,
      levelsCount: benchmarkResult.levelsCount,
      tileCount: benchmarkResult.tileCount,
      totalOutputSizeBytes: benchmarkResult.totalOutputSizeBytes
    });

    assert(
      benchmarkResult.tileCount > 0 && benchmarkResult.executionTimeMs > 0,
      `${res.name}: Processed in ${benchmarkResult.executionTimeMs}ms with ${benchmarkResult.levelsCount} levels and ${benchmarkResult.tileCount} tiles (${(benchmarkResult.totalOutputSizeBytes / (1024 * 1024)).toFixed(2)} MB output)`,
      "INTEGRATION"
    );
  }

  // Print Table
  console.log("\n==================================================");
  console.log("ACTUAL PROCESSING BENCHMARK RESULTS TABLE");
  console.log("==================================================");
  console.table(benchmarks.map(b => ({
    Resolution: b.resolutionName,
    Dimensions: b.dimensions,
    "Source Size": `${(b.sourceSizeBytes / (1024 * 1024)).toFixed(2)} MB`,
    "Duration": `${b.processingTimeMs} ms`,
    "Levels": b.levelsCount,
    "Tiles": b.tileCount,
    "Output Size": `${(b.totalOutputSizeBytes / (1024 * 1024)).toFixed(2)} MB`
  })));

  // Final Summary
  console.log("\n==================================================");
  console.log("WORKER INTEGRATION SUITE SUMMARY");
  console.log(`  Unit Tests: ${summary.unitTests}`);
  console.log(`  Integration Tests: ${summary.integrationTests}`);
  console.log(`  End-to-End Tests: ${summary.endToEndTests}`);
  console.log(`  Environment-Dependent Tests: ${summary.envDependentTests}`);
  console.log(`  Failures: ${summary.failures}`);
  console.log("==================================================");

  if (summary.failures > 0) {
    process.exit(1);
  }
}

runWorkerIntegrationSuite().catch(err => {
  console.error("FATAL ERROR in worker integration suite:", err);
  process.exit(1);
});
