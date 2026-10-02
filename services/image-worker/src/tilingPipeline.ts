import sharp from "sharp";
import { StorageService } from "../../../packages/storage/src/StorageService";

export interface PanoramaValidationResult {
  isValid: boolean;
  width: number;
  height: number;
  aspectRatio: number;
  mimeType: string;
  sizeBytes: number;
  errorMessage?: string;
}

export interface TileLevel {
  level: number;
  width: number;
  height: number;
  tilesX: number;
  tilesY: number;
  tileSize: number;
}

export interface PanoramaManifest {
  projection: "equirectangular";
  width: number;
  height: number;
  tileSize: number;
  previewUrl: string;
  thumbnailUrl: string;
  levels: TileLevel[];
  createdAt: string;
}

export interface ProcessPanoramaOptions {
  sourceBuffer: Buffer;
  organizationId: string;
  tourId: string;
  scanId: string;
  storageService: StorageService;
  onProgress?: (progress: number, step: string) => Promise<void> | void;
}

export interface PanoramaProcessingResult {
  manifest: PanoramaManifest;
  manifestKey: string;
  previewKey: string;
  thumbKey: string;
  originalKey: string;
  levelsCount: number;
  tileCount: number;
  totalOutputSizeBytes: number;
  executionTimeMs: number;
}

export class TilingPipeline {
  private readonly tileSize = 512;
  private readonly maxUploadSizeBytes = 200 * 1024 * 1024; // 200 MB plan limit

  /**
   * 1. Detect and Validate 360 Equirectangular Panoramas from real Buffer with Sharp
   */
  async validateImageBuffer(buffer: Buffer): Promise<PanoramaValidationResult> {
    const sizeBytes = buffer.length;
    if (sizeBytes === 0) {
      return {
        isValid: false,
        width: 0,
        height: 0,
        aspectRatio: 0,
        mimeType: "unknown",
        sizeBytes: 0,
        errorMessage: "Uploaded file is empty (0 bytes)."
      };
    }

    if (sizeBytes > this.maxUploadSizeBytes) {
      return {
        isValid: false,
        width: 0,
        height: 0,
        aspectRatio: 0,
        mimeType: "unknown",
        sizeBytes,
        errorMessage: `File size exceeds 200 MB limit (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB).`
      };
    }

    try {
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const format = metadata.format || "unknown";
      const mimeType = format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : format === "webp" ? "image/webp" : `image/${format}`;

      const supportedFormats = ["jpeg", "png", "webp"];
      if (!supportedFormats.includes(format)) {
        return {
          isValid: false,
          width,
          height,
          aspectRatio: width / (height || 1),
          mimeType,
          sizeBytes,
          errorMessage: `Unsupported file format '${format}'. Supported formats: JPG, PNG, WebP.`
        };
      }

      if (width < 2048 || height < 1024) {
        return {
          isValid: false,
          width,
          height,
          aspectRatio: width / (height || 1),
          mimeType,
          sizeBytes,
          errorMessage: `Resolution too low (${width}x${height}). Minimum required is 2048x1024.`
        };
      }

      const ratio = width / (height || 1);
      if (Math.abs(ratio - 2.0) > 0.08) {
        return {
          isValid: false,
          width,
          height,
          aspectRatio: ratio,
          mimeType,
          sizeBytes,
          errorMessage: `Invalid aspect ratio ${ratio.toFixed(2)}:1. 360° equirectangular panoramas must have 2:1 ratio.`
        };
      }

      return {
        isValid: true,
        width,
        height,
        aspectRatio: ratio,
        mimeType,
        sizeBytes
      };
    } catch (err: any) {
      return {
        isValid: false,
        width: 0,
        height: 0,
        aspectRatio: 0,
        mimeType: "unknown",
        sizeBytes,
        errorMessage: `Image corruption or invalid format: ${err.message}`
      };
    }
  }

  /**
   * Synchronous validation method
   */
  validatePanorama(
    width: number,
    height: number,
    sizeBytes: number,
    mimeType: string
  ): PanoramaValidationResult {
    const supportedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!supportedMimes.includes(mimeType)) {
      return {
        isValid: false,
        width,
        height,
        aspectRatio: width / (height || 1),
        mimeType,
        sizeBytes,
        errorMessage: `Unsupported file format '${mimeType}'. Supported: JPG, PNG, WebP.`
      };
    }

    if (sizeBytes > this.maxUploadSizeBytes) {
      return {
        isValid: false,
        width,
        height,
        aspectRatio: width / (height || 1),
        mimeType,
        sizeBytes,
        errorMessage: `File size exceeds 200 MB limit (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB).`
      };
    }

    if (width < 2048 || height < 1024) {
      return {
        isValid: false,
        width,
        height,
        aspectRatio: width / (height || 1),
        mimeType,
        sizeBytes,
        errorMessage: `Resolution too low (${width}x${height}). Minimum is 2048x1024.`
      };
    }

    const ratio = width / height;
    if (Math.abs(ratio - 2.0) > 0.08) {
      return {
        isValid: false,
        width,
        height,
        aspectRatio: ratio,
        mimeType,
        sizeBytes,
        errorMessage: `Invalid aspect ratio ${ratio.toFixed(2)}:1. 360° equirectangular panoramas must be 2:1.`
      };
    }

    return {
      isValid: true,
      width,
      height,
      aspectRatio: ratio,
      mimeType,
      sizeBytes
    };
  }

  /**
   * 2. Calculate dynamic multi-resolution levels from source resolution (Part 1, Req 3)
   */
  calculateResolutionLevels(sourceWidth: number, sourceHeight: number): TileLevel[] {
    const levels: TileLevel[] = [];
    let currentW = sourceWidth;
    let currentH = sourceHeight;
    const tempLevels: { w: number; h: number }[] = [];

    while (currentW >= this.tileSize) {
      tempLevels.push({ w: currentW, h: currentH });
      currentW = Math.round(currentW / 2);
      currentH = Math.round(currentH / 2);
    }

    tempLevels.reverse().forEach((dim, idx) => {
      const tilesX = Math.ceil(dim.w / this.tileSize);
      const tilesY = Math.ceil(dim.h / this.tileSize);
      levels.push({
        level: idx,
        width: dim.w,
        height: dim.h,
        tilesX,
        tilesY,
        tileSize: this.tileSize
      });
    });

    return levels;
  }

  /**
   * 3. Construct storage path matching organization hierarchy
   */
  getTileStoragePath(
    organizationId: string,
    tourId: string,
    scanId: string,
    level: number,
    x: number,
    y: number
  ): string {
    return `organizations/${organizationId}/tours/${tourId}/scans/${scanId}/panoramas/tiles/level-${level}/${x}-${y}.jpg`;
  }

  /**
   * 4. Generate standard Panorama Manifest
   */
  createManifest(
    organizationId: string,
    tourId: string,
    scanId: string,
    width: number,
    height: number,
    storageService: StorageService
  ): PanoramaManifest {
    const levels = this.calculateResolutionLevels(width, height);
    const previewKey = `organizations/${organizationId}/tours/${tourId}/scans/${scanId}/previews/preview.jpg`;
    const thumbKey = `organizations/${organizationId}/tours/${tourId}/scans/${scanId}/previews/thumb.webp`;

    return {
      projection: "equirectangular",
      width,
      height,
      tileSize: this.tileSize,
      previewUrl: storageService.getPublicUrl(previewKey),
      thumbnailUrl: storageService.getPublicUrl(thumbKey),
      levels,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * 5. Real End-to-End Processing using Sharp / libvips
   */
  async processPanorama(options: ProcessPanoramaOptions): Promise<PanoramaProcessingResult> {
    const startTime = Date.now();
    const { sourceBuffer, organizationId, tourId, scanId, storageService, onProgress } = options;

    // Stage 1: Validation (10%)
    if (onProgress) await onProgress(10, "Validating 360 equirectangular source");
    const validation = await this.validateImageBuffer(sourceBuffer);
    if (!validation.isValid) {
      throw new Error(`Panorama validation failed: ${validation.errorMessage}`);
    }

    let totalOutputBytes = 0;
    const width = validation.width;
    const height = validation.height;

    // Stage 2: Previews (25%)
    if (onProgress) await onProgress(25, "Generating 2K preview and thumbnail");
    const previewKey = `organizations/${organizationId}/tours/${tourId}/scans/${scanId}/previews/preview.jpg`;
    const thumbKey = `organizations/${organizationId}/tours/${tourId}/scans/${scanId}/previews/thumb.webp`;
    const originalKey = `organizations/${organizationId}/tours/${tourId}/scans/${scanId}/raw/original.jpg`;

    // 2K Preview
    const previewBuffer = await sharp(sourceBuffer)
      .resize(2048, 1024, { fit: "fill" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    await storageService.upload(previewKey, previewBuffer, "image/jpeg");
    totalOutputBytes += previewBuffer.length;

    // Thumbnail
    const thumbBuffer = await sharp(sourceBuffer)
      .resize(400, 200, { fit: "fill" })
      .webp({ quality: 80 })
      .toBuffer();
    await storageService.upload(thumbKey, thumbBuffer, "image/webp");
    totalOutputBytes += thumbBuffer.length;

    // Store original in raw storage
    await storageService.upload(originalKey, sourceBuffer, validation.mimeType);
    totalOutputBytes += sourceBuffer.length;

    // Stage 3: Multi-resolution libvips tiling (30% -> 80%)
    if (onProgress) await onProgress(40, "Calculating resolution levels and tiling with libvips");
    const levels = this.calculateResolutionLevels(width, height);
    let tileCount = 0;

    for (let li = 0; li < levels.length; li++) {
      const lvl = levels[li];
      const levelProgress = 40 + Math.round(((li + 1) / levels.length) * 40);
      if (onProgress) await onProgress(levelProgress, `Tiling resolution Level ${lvl.level} (${lvl.width}x${lvl.height})`);

      // Resize entire level using Sharp
      const levelImageBuffer = await sharp(sourceBuffer)
        .resize(lvl.width, lvl.height, { fit: "fill" })
        .toBuffer();

      // Extract tiles
      for (let ty = 0; ty < lvl.tilesY; ty++) {
        for (let tx = 0; tx < lvl.tilesX; tx++) {
          const left = tx * lvl.tileSize;
          const top = ty * lvl.tileSize;
          const extractWidth = Math.min(lvl.tileSize, lvl.width - left);
          const extractHeight = Math.min(lvl.tileSize, lvl.height - top);

          const tileBuffer = await sharp(levelImageBuffer)
            .extract({ left, top, width: extractWidth, height: extractHeight })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();

          const tilePath = this.getTileStoragePath(organizationId, tourId, scanId, lvl.level, tx, ty);
          await storageService.upload(tilePath, tileBuffer, "image/jpeg");
          totalOutputBytes += tileBuffer.length;
          tileCount++;
        }
      }
    }

    // Stage 4: Manifest (90%)
    if (onProgress) await onProgress(90, "Assembling panorama tile manifest");
    const manifest: PanoramaManifest = {
      projection: "equirectangular",
      width,
      height,
      tileSize: this.tileSize,
      previewUrl: storageService.getPublicUrl(previewKey),
      thumbnailUrl: storageService.getPublicUrl(thumbKey),
      levels,
      createdAt: new Date().toISOString()
    };

    const manifestKey = `organizations/${organizationId}/tours/${tourId}/scans/${scanId}/manifest.json`;
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
    await storageService.upload(manifestKey, manifestBuffer, "application/json");
    totalOutputBytes += manifestBuffer.length;

    // Stage 5: Complete (100%)
    if (onProgress) await onProgress(100, "Multi-resolution panorama processing complete");

    const executionTimeMs = Date.now() - startTime;
    return {
      manifest,
      manifestKey,
      previewKey,
      thumbKey,
      originalKey,
      levelsCount: levels.length,
      tileCount,
      totalOutputSizeBytes: totalOutputBytes,
      executionTimeMs
    };
  }
}

