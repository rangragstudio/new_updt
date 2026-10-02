import * as crypto from "crypto";
import * as path from "path";
import AdmZip from "adm-zip";
import { StorageService } from "../../storage/src/StorageService";
import { TilingPipeline } from "../../../services/image-worker/src/tilingPipeline";

/**
 * RenderWalk Appendix C Specification
 */
export interface AppendixCScanItem {
  id: string;
  image: string;
  depth?: string;
  position: [number, number, number];
  rotation_deg?: { yaw: number; pitch: number; roll: number };
  yaw?: number;
  room?: string;
  level?: string;
}

export interface AppendixCManifest {
  version: number;
  name?: string;
  tour_name?: string;
  units?: "m" | "ft";
  up_axis?: "z" | "y";
  source?: string;
  scans: AppendixCScanItem[];
}

export interface ZipImportResult {
  success: boolean;
  tourId?: string;
  tourName: string;
  checksum: string;
  scansCount: number;
  roomsCount: number;
  extractedFiles: string[];
  processedScans: Array<{
    scanId: string;
    room: string;
    imagePath: string;
    position: [number, number, number];
    manifestKey: string;
  }>;
  isDuplicate: boolean;
  errorMessage?: string;
}

export class ZipRenderPackageImportService {
  private importedChecksums = new Set<string>();
  private readonly maxZipSizeBytes = 300 * 1024 * 1024; // 300 MB limit
  private readonly maxTotalUncompressedBytes = 600 * 1024 * 1024; // 600 MB max uncompressed
  private readonly maxFileCount = 200;
  private readonly allowedExtensions = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".json",
    ".exr"
  ]);

  constructor(
    private storageService: StorageService,
    private tilingPipeline: TilingPipeline = new TilingPipeline()
  ) {}

  /**
   * Calculate SHA-256 checksum of ZIP buffer
   */
  calculateChecksum(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Validate ZIP security (Zip-Slip path traversal, Zip Bomb, extension whitelist)
   */
  validateZipSecurity(zip: AdmZip): { isValid: boolean; error?: string } {
    const entries = zip.getEntries();

    if (entries.length === 0) {
      return { isValid: false, error: "ZIP archive is empty." };
    }

    if (entries.length > this.maxFileCount) {
      return {
        isValid: false,
        error: `ZIP contains too many files (${entries.length} > ${this.maxFileCount}).`
      };
    }

    let totalUncompressed = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const entryName = entry.entryName;

      // 1. Path traversal / Zip-Slip check
      if (
        entryName.includes("..") ||
        entryName.startsWith("/") ||
        entryName.startsWith("\\") ||
        /^[a-zA-Z]:/.test(entryName) || // Windows drive letter
        entryName.includes("\0") // Null byte injection
      ) {
        return {
          isValid: false,
          error: `Security violation: Path traversal detected in entry '${entryName}'.`
        };
      }

      // 2. Extension check
      const ext = path.extname(entryName).toLowerCase();
      if (!this.allowedExtensions.has(ext)) {
        return {
          isValid: false,
          error: `Security violation: Disallowed file extension '${ext}' in entry '${entryName}'.`
        };
      }

      // 3. Zip bomb check
      totalUncompressed += entry.header.size;
      if (totalUncompressed > this.maxTotalUncompressedBytes) {
        return {
          isValid: false,
          error: `Security violation: Uncompressed archive size exceeds ${this.maxTotalUncompressedBytes / (1024 * 1024)} MB limit.`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate Appendix C Manifest schema
   */
  validateAppendixCManifest(
    manifest: any,
    availableFiles: Set<string>
  ): { isValid: boolean; error?: string } {
    if (!manifest || typeof manifest !== "object") {
      return { isValid: false, error: "manifest.json is empty or invalid JSON." };
    }

    if (manifest.version !== 1 && manifest.version !== 2) {
      return {
        isValid: false,
        error: `Unsupported manifest version '${manifest.version}'. Expected version 1 or 2.`
      };
    }

    if (!Array.isArray(manifest.scans) || manifest.scans.length === 0) {
      return {
        isValid: false,
        error: "Manifest must contain a non-empty 'scans' array."
      };
    }

    const seenIds = new Set<string>();

    for (const scan of manifest.scans) {
      if (!scan.id || typeof scan.id !== "string" || scan.id.trim() === "") {
        return { isValid: false, error: "Scan item missing valid 'id'." };
      }

      if (seenIds.has(scan.id)) {
        return {
          isValid: false,
          error: `Duplicate scan identifier '${scan.id}' detected in manifest.`
        };
      }
      seenIds.add(scan.id);

      if (!scan.image || typeof scan.image !== "string") {
        return {
          isValid: false,
          error: `Scan '${scan.id}' missing required 'image' path.`
        };
      }

      // Normalize relative image path
      const cleanImgPath = scan.image.replace(/^\.\//, "").replace(/\\/g, "/");
      if (!availableFiles.has(cleanImgPath)) {
        return {
          isValid: false,
          error: `Asset file '${scan.image}' referenced by scan '${scan.id}' not found in archive.`
        };
      }

      // Check position coordinates
      if (
        !Array.isArray(scan.position) ||
        scan.position.length !== 3 ||
        scan.position.some((p: any) => typeof p !== "number" || isNaN(p))
      ) {
        return {
          isValid: false,
          error: `Scan '${scan.id}' has invalid 3D position [x, y, z].`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Full Real ZIP Package Ingestion Workflow
   */
  async importZipPackage(params: {
    zipBuffer: Buffer;
    organizationId: string;
    tourName?: string;
  }): Promise<ZipImportResult> {
    const { zipBuffer, organizationId } = params;

    // Check size limit
    if (zipBuffer.length > this.maxZipSizeBytes) {
      return {
        success: false,
        tourName: params.tourName || "Unknown",
        checksum: "",
        scansCount: 0,
        roomsCount: 0,
        extractedFiles: [],
        processedScans: [],
        isDuplicate: false,
        errorMessage: `Package exceeds maximum size limit of ${this.maxZipSizeBytes / (1024 * 1024)} MB.`
      };
    }

    // 1. Calculate SHA-256 Checksum
    const checksum = this.calculateChecksum(zipBuffer);

    // 2. Duplicate Detection
    if (this.importedChecksums.has(checksum)) {
      return {
        success: false,
        tourName: params.tourName || "Duplicate Tour",
        checksum,
        scansCount: 0,
        roomsCount: 0,
        extractedFiles: [],
        processedScans: [],
        isDuplicate: true,
        errorMessage: `This render package has already been imported (SHA-256: ${checksum.substring(0, 12)}...).`
      };
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (err: any) {
      return {
        success: false,
        tourName: params.tourName || "Corrupt Archive",
        checksum,
        scansCount: 0,
        roomsCount: 0,
        extractedFiles: [],
        processedScans: [],
        isDuplicate: false,
        errorMessage: `Corrupted ZIP archive: ${err.message}`
      };
    }

    // 3. Security Validation (Zip-Slip & Zip Bomb)
    const securityCheck = this.validateZipSecurity(zip);
    if (!securityCheck.isValid) {
      return {
        success: false,
        tourName: params.tourName || "Rejected Tour",
        checksum,
        scansCount: 0,
        roomsCount: 0,
        extractedFiles: [],
        processedScans: [],
        isDuplicate: false,
        errorMessage: securityCheck.error
      };
    }

    // 4. Locate and parse manifest.json
    const entries = zip.getEntries();
    const manifestEntry = entries.find(
      (e: AdmZip.IZipEntry) => e.entryName === "manifest.json" || e.entryName.endsWith("/manifest.json")
    );

    if (!manifestEntry) {
      return {
        success: false,
        tourName: params.tourName || "Missing Manifest",
        checksum,
        scansCount: 0,
        roomsCount: 0,
        extractedFiles: [],
        processedScans: [],
        isDuplicate: false,
        errorMessage: "Required 'manifest.json' not found in root of render package."
      };
    }

    let manifest: AppendixCManifest;
    try {
      const manifestText = manifestEntry.getData().toString("utf8");
      manifest = JSON.parse(manifestText);
    } catch (err: any) {
      return {
        success: false,
        tourName: params.tourName || "Invalid JSON",
        checksum,
        scansCount: 0,
        roomsCount: 0,
        extractedFiles: [],
        processedScans: [],
        isDuplicate: false,
        errorMessage: `Failed to parse manifest.json: ${err.message}`
      };
    }

    // 5. Build available file map
    const availableFiles = new Set<string>();
    entries.forEach((e: AdmZip.IZipEntry) => {
      if (!e.isDirectory) {
        availableFiles.add(e.entryName.replace(/\\/g, "/"));
      }
    });

    // 6. Validate Appendix C Manifest
    const manifestCheck = this.validateAppendixCManifest(manifest, availableFiles);
    if (!manifestCheck.isValid) {
      return {
        success: false,
        tourName: manifest.tour_name || manifest.name || params.tourName || "Invalid Manifest",
        checksum,
        scansCount: 0,
        roomsCount: 0,
        extractedFiles: [],
        processedScans: [],
        isDuplicate: false,
        errorMessage: manifestCheck.error
      };
    }

    const tourId = `tour-pkg-${Date.now()}`;
    const tourName = manifest.tour_name || manifest.name || params.tourName || "Imported Render Tour";
    const uniqueRooms = new Set<string>();
    const extractedFiles: string[] = [];
    const processedScans: ZipImportResult["processedScans"] = [];

    // 7. Extract files safely and process scan assets
    for (const scan of manifest.scans) {
      const cleanImgPath = scan.image.replace(/^\.\//, "").replace(/\\/g, "/");
      const imageEntry = entries.find((e: AdmZip.IZipEntry) => e.entryName === cleanImgPath);

      if (!imageEntry) {
        throw new Error(`Asset entry '${cleanImgPath}' unexpectedly missing.`);
      }

      const imageBuffer = imageEntry.getData();
      const ext = path.extname(cleanImgPath).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

      // Upload raw asset to storage
      const storageKey = `organizations/${organizationId}/tours/${tourId}/scans/${scan.id}/raw/source${ext}`;
      await this.storageService.upload(storageKey, imageBuffer, mimeType);
      extractedFiles.push(storageKey);

      // Process real multi-resolution panorama tiling
      const tilingResult = await this.tilingPipeline.processPanorama({
        sourceBuffer: imageBuffer,
        organizationId,
        tourId,
        scanId: scan.id,
        storageService: this.storageService
      });

      const roomName = scan.room || "Main Space";
      uniqueRooms.add(roomName);

      processedScans.push({
        scanId: scan.id,
        room: roomName,
        imagePath: storageKey,
        position: scan.position,
        manifestKey: tilingResult.manifestKey
      });
    }

    this.importedChecksums.add(checksum);

    return {
      success: true,
      tourId,
      tourName,
      checksum,
      scansCount: manifest.scans.length,
      roomsCount: uniqueRooms.size,
      extractedFiles,
      processedScans,
      isDuplicate: false
    };
  }
}
