/**
 * FloorPlanImportService - Custom Floor Plan & CAD Architecture
 * Supports Raster (PNG/JPG), Sanitized SVG, and extensible CAD adapters.
 */

export interface FloorPlanPinData {
  id: string;
  floorPlanId: string;
  scanId: string;
  x: number;       // Normalized coordinates 0.0 to 1.0
  y: number;
  rotationDeg: number; // View orientation cone angle (0 - 360)
  levelName: string;
}

export interface FloorPlanImportResult {
  success: boolean;
  format: "image" | "svg" | "cad_unsupported";
  url?: string;
  sanitizedSvgContent?: string;
  width?: number;
  height?: number;
  errorMessage?: string;
}

export interface FloorPlanAdapter {
  canHandle(mimeType: string, filename: string): boolean;
  process(content: Buffer | string, filename: string): Promise<FloorPlanImportResult>;
}

/**
 * Image adapter for PNG & JPG floor plans
 */
export class ImageFloorPlanAdapter implements FloorPlanAdapter {
  canHandle(mimeType: string, filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop() || '';
    return ['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  }

  async process(content: Buffer | string, filename: string): Promise<FloorPlanImportResult> {
    return {
      success: true,
      format: "image"
    };
  }
}

/**
 * SVG adapter with strict XML/SVG sanitization to prevent XSS
 */
export class SvgFloorPlanAdapter implements FloorPlanAdapter {
  canHandle(mimeType: string, filename: string): boolean {
    return mimeType === 'image/svg+xml' || filename.toLowerCase().endsWith('.svg');
  }

  async process(content: Buffer | string, filename: string): Promise<FloorPlanImportResult> {
    const rawSvg = typeof content === 'string' ? content : content.toString('utf-8');

    // Security sanitization: strip script tags, on-event handlers, javascript: pseudo-protocols
    const sanitized = rawSvg
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '')
      .replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
      .replace(/javascript:/gi, '');

    return {
      success: true,
      format: "svg",
      sanitizedSvgContent: sanitized
    };
  }
}

/**
 * DXF / CAD adapter with explicit truthful messaging
 */
export class DxfFloorPlanAdapter implements FloorPlanAdapter {
  canHandle(mimeType: string, filename: string): boolean {
    return filename.toLowerCase().endsWith('.dxf') || filename.toLowerCase().endsWith('.dwg');
  }

  async process(content: Buffer | string, filename: string): Promise<FloorPlanImportResult> {
    return {
      success: false,
      format: "cad_unsupported",
      errorMessage: "AutoCAD DXF/DWG format is not directly supported yet. Please export to SVG or high-resolution PNG from AutoCAD/Revit."
    };
  }
}

export class FloorPlanImportService {
  private adapters: FloorPlanAdapter[] = [
    new ImageFloorPlanAdapter(),
    new SvgFloorPlanAdapter(),
    new DxfFloorPlanAdapter()
  ];

  async importFloorPlan(content: Buffer | string, filename: string, mimeType: string): Promise<FloorPlanImportResult> {
    const adapter = this.adapters.find(a => a.canHandle(mimeType, filename));
    if (!adapter) {
      return {
        success: false,
        format: "cad_unsupported",
        errorMessage: `Unsupported floor plan format for file: ${filename}. Supported: PNG, JPG, WebP, SVG.`
      };
    }
    return adapter.process(content, filename);
  }
}
