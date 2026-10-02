/**
 * TourImportService - Controlled Import Workflow for 360 Panoramas and Render Packages
 * Complies with Developer Brief Appendix C & Part 10 requirements.
 */

export interface RenderPackageScanItem {
  id: string;
  image: string;       // Path to equirectangular 360 image
  depth?: string;      // Path to 32-bit float EXR or 16-bit PNG depth pass
  position: [number, number, number]; // [x, y, z] in meters
  rotation_deg: { yaw: number; pitch: number; roll: number };
  room: string;
  level: string;
}

export interface RenderPackageManifest {
  version: number;
  units: "m" | "ft";
  up_axis: "z" | "y";
  source: string; // e.g. "sketchup+vray", "enscape", "d5"
  scans: RenderPackageScanItem[];
}

export interface ImportTourResult {
  success: boolean;
  tourId?: string;
  tourName: string;
  roomsCount: number;
  scansCount: number;
  queuedJobsCount: number;
  isDuplicate: boolean;
  errorMessage?: string;
}

export class TourImportService {
  private importedPackageHashes = new Set<string>();

  /**
   * Validates manifest structure according to Developer Brief Appendix C
   */
  validateManifest(manifest: any): { isValid: boolean; error?: string } {
    if (!manifest || typeof manifest !== 'object') {
      return { isValid: false, error: "Manifest is empty or invalid JSON." };
    }
    if (!manifest.scans || !Array.isArray(manifest.scans) || manifest.scans.length === 0) {
      return { isValid: false, error: "Manifest must contain a non-empty 'scans' array." };
    }
    for (const scan of manifest.scans) {
      if (!scan.id || !scan.image) {
        return { isValid: false, error: `Scan item missing required 'id' or 'image' field.` };
      }
      if (!scan.position || !Array.isArray(scan.position) || scan.position.length !== 3) {
        return { isValid: false, error: `Scan '${scan.id}' must specify 3D position [x, y, z].` };
      }
    }
    return { isValid: true };
  }

  /**
   * Controlled Repeatable Import Workflow with Checksum Deduplication (Part 10)
   */
  async importRenderPackage(
    organizationId: string,
    tourName: string,
    manifest: RenderPackageManifest,
    packageHash: string
  ): Promise<ImportTourResult> {
    // 1. Duplicate Dataset Detection
    if (this.importedPackageHashes.has(packageHash)) {
      return {
        success: false,
        tourName,
        roomsCount: 0,
        scansCount: 0,
        queuedJobsCount: 0,
        isDuplicate: true,
        errorMessage: "This render package has already been imported. Checksums match existing tour."
      };
    }

    // 2. Validate Schema
    const validation = this.validateManifest(manifest);
    if (!validation.isValid) {
      return {
        success: false,
        tourName,
        roomsCount: 0,
        scansCount: 0,
        queuedJobsCount: 0,
        isDuplicate: false,
        errorMessage: validation.error
      };
    }

    // 3. Extract unique rooms
    const uniqueRooms = new Set<string>();
    manifest.scans.forEach(s => uniqueRooms.add(s.room || "Main Space"));

    this.importedPackageHashes.add(packageHash);

    return {
      success: true,
      tourId: `tour-import-${Date.now()}`,
      tourName,
      roomsCount: uniqueRooms.size,
      scansCount: manifest.scans.length,
      queuedJobsCount: manifest.scans.length,
      isDuplicate: false
    };
  }
}
