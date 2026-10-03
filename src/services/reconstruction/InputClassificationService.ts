/**
 * ============================================================================
 * RenderWalk Input Classification Service (Task 33A)
 * ============================================================================
 *
 * Server-authoritative classification of uploaded files into:
 * - VALID_EQUIRECTANGULAR_PANORAMA (bypasses Task 33 reconstruction)
 * - VALID_PERSPECTIVE_PHOTO_SET (routes to Task 33 reconstruction)
 * - INSUFFICIENT_RECONSTRUCTION_INPUT (single normal photo or empty set)
 * - UNSUPPORTED_IMAGE_FORMAT
 * - CORRUPTED_IMAGE
 *
 * Strictly preserves existing panorama import behavior while enabling
 * dynamic N-image perspective sets without exposing technical terms to users.
 */

import {
  InputValidationState,
  ReconstructionInputType,
  ExifMetadataHints
} from "./ReconstructionModels";

export interface UploadedFileCandidate {
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType?: string;
  readonly fileSizeBytes: number;
  readonly isCorrupted?: boolean;
  readonly exif?: ExifMetadataHints;
}

export interface FileClassificationResult {
  readonly state: InputValidationState;
  readonly inputType?: ReconstructionInputType;
  readonly bypassReconstruction: boolean;
  readonly isSupported: boolean;
  readonly errorMessage?: string;
  readonly fileCount: number;
}

export class InputClassificationService {
  private static readonly SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
  private static readonly SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

  /**
   * Authoritatively classifies an uploaded set of image files.
   */
  public static classify(files: readonly UploadedFileCandidate[]): FileClassificationResult {
    if (!files || files.length === 0) {
      return {
        state: "INSUFFICIENT_RECONSTRUCTION_INPUT",
        bypassReconstruction: false,
        isSupported: false,
        errorMessage: "No files provided.",
        fileCount: 0
      };
    }

    // 1. Check supported formats
    for (const f of files) {
      const lowerName = f.filename.toLowerCase();
      const hasValidExt = this.SUPPORTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
      const hasValidMime = f.mimeType ? this.SUPPORTED_MIME_TYPES.includes(f.mimeType.toLowerCase()) : false;

      if (!hasValidExt && !hasValidMime) {
        return {
          state: "UNSUPPORTED_IMAGE_FORMAT",
          bypassReconstruction: false,
          isSupported: false,
          errorMessage: `Unsupported image format for '${f.filename}'. Supported formats are JPG, PNG, and WebP.`,
          fileCount: files.length
        };
      }
    }

    // 2. Check for corrupted files or non-positive dimensions
    for (const f of files) {
      if (f.isCorrupted || f.width <= 0 || f.height <= 0 || f.fileSizeBytes <= 0) {
        return {
          state: "CORRUPTED_IMAGE",
          bypassReconstruction: false,
          isSupported: false,
          errorMessage: `Image file '${f.filename}' is corrupted or cannot be decoded.`,
          fileCount: files.length
        };
      }
    }

    // 3. Evaluate aspect ratios
    const equirectangularFiles = files.filter((f) => {
      const ratio = f.width / f.height;
      return ratio >= 1.85 && ratio <= 2.15 && f.width >= 1024 && f.height >= 512;
    });

    // Case A: All files are existing ~2:1 equirectangular panoramas
    if (equirectangularFiles.length === files.length) {
      return {
        state: "VALID_EQUIRECTANGULAR_PANORAMA",
        inputType: "EXISTING_EQUIRECTANGULAR_PANORAMA",
        bypassReconstruction: true,
        isSupported: true,
        fileCount: files.length
      };
    }

    // Case C: Single ordinary perspective photo
    if (files.length === 1) {
      return {
        state: "INSUFFICIENT_RECONSTRUCTION_INPUT",
        bypassReconstruction: false,
        isSupported: false,
        errorMessage: "INSUFFICIENT_RECONSTRUCTION_INPUT: A single perspective photograph is insufficient for 360° room reconstruction. Please upload at least 2 or more overlapping photos of the space.",
        fileCount: 1
      };
    }

    // Case B: Perspective Photo Set (N >= 2)
    return {
      state: "VALID_PERSPECTIVE_PHOTO_SET",
      inputType: "PERSPECTIVE_PHOTO_SET",
      bypassReconstruction: false,
      isSupported: true,
      fileCount: files.length
    };
  }
}
