// RenderWalk Models & Types
// Ported faithfully from com.example.model.RenderWalkModels

export type UserRole =
  | 'SUPER_ADMIN'
  | 'PARTNER_ADMIN'
  | 'OWNER'
  | 'EDITOR'
  | 'VIEWER';

export type TourStatus =
  | 'ALL'
  | 'DRAFT'
  | 'PROCESSING'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'ARCHIVED';

export type LinkStyle =
  | 'FLOOR_RING'
  | 'DIRECTION_ARROW'
  | 'LABEL_PILL'
  | 'DOORWAY_PORTAL';

export type ContentType =
  | 'PRODUCT'
  | 'INFO'
  | 'CONTACT'
  | 'LINK'
  | 'IMAGE';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'CLOSED';

export type JobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'DONE'
  | 'FAILED'
  | 'NEEDS_ATTENTION';

export type WarningSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR';

export enum PlanCapability {
  TOUR_LIMIT = 'TOUR_LIMIT',
  STORAGE_LIMIT = 'STORAGE_LIMIT',
  ADVANCED_HOTSPOTS = 'ADVANCED_HOTSPOTS',
  FLOOR_PLAN = 'FLOOR_PLAN',
  DOLLHOUSE = 'DOLLHOUSE',
  CUSTOM_BRANDING = 'CUSTOM_BRANDING',
  PASSWORD_PROTECTION = 'PASSWORD_PROTECTION',
  CUSTOM_DOMAIN = 'CUSTOM_DOMAIN',
  VIDEO_EXPORT = 'VIDEO_EXPORT',
  PRESENTATION_MODE = 'PRESENTATION_MODE',
  ANALYTICS = 'ANALYTICS',
  LEAD_CAPTURE = 'LEAD_CAPTURE',
  API_ACCESS = 'API_ACCESS'
}

export interface PlanDefinition {
  id: string;
  name: 'Starter' | 'Studio' | 'Partner';
  maxActiveTours: number;
  storageLimitGb: number;
  maxScansPerTour: number;
  monthlyPriceInr: number;
  yearlyPriceInr: number;
  capabilities: Set<PlanCapability>;
}

export interface PublishValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TileLevel {
  level: number;
  width: number;
  height: number;
  tilesX: number;
  tilesY: number;
  tileSize?: number;
}

export interface TileManifest {
  projection: string;
  width: number;
  height: number;
  tileSize: number;
  levels: TileLevel[];
  previewUrl: string;
  thumbnailUrl: string;
}

export interface PublicScanView {
  id: string;
  name: string;
  roomName: string;
  isStartScan: boolean;
  yaw: number;
  pitch: number;
  hfov: number;
  tileManifest?: TileManifest | null;
}

export interface PublicTourView {
  publicSlug: string;
  publicToken: string;
  tourName: string;
  propertyType: string;
  address: string;
  brandColorHex: string;
  startScanId: string;
  scans: PublicScanView[];
  links: Link[];
  contentItems: ContentItem[];
  isProtected: boolean;
}

export interface StorageAccountingBreakdown {
  organizationId: string;
  originalUploadsBytes: number;
  panoramaTilesBytes: number;
  previewAssetsBytes: number;
  thumbnailsBytes: number;
  floorPlansBytes: number;
  renderPackagesBytes: number;
  totalBytes: number;
  storageQuotaBytes: number;
  storageLimitGb: number;
  isQuotaExceeded: boolean;
}

export interface NotificationItem {
  id: string;
  orgId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead?: boolean;
}

export interface CustomDomainConfig {
  id: string;
  orgId: string;
  hostname: string;
  status: 'pending' | 'verified' | 'error';
  sslActive: boolean;
  cnameTarget: string;
}

export interface FloorPlanPin {
  id: string;
  scanId: string;
  scanName: string;
  x: number; // Normalized 0.0 .. 1.0
  y: number; // Normalized 0.0 .. 1.0
  headingDeg: number;
  levelName: string;
}

export interface FloorPlan {
  id: string;
  tourId: string;
  levelName: string;
  title: string;
  format: string; // 'PNG' | 'SVG' | 'PDF'
  imageUrl?: string;
  pins: FloorPlanPin[];
}

export interface RenderPackageScanItem {
  id: string;
  room: string;
  level?: string;
  image: string;
  posX: number;
  posY: number;
  posZ?: number;
  rotationYaw: number;
}

export interface RenderPackage {
  name: string;
  source: string;
  scans: RenderPackageScanItem[];
  checksum: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
}

export interface Organization {
  id: string;
  name: string;
  industry: string;
  brandColorHex: string;
  whatsappNumber: string;
  planName: string;
  storageUsedGb: number;
  storageLimitGb: number;
  activeToursCount: number;
  maxToursLimit: number;
}

export interface Tour {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  publicToken: string;
  propertyType: string;
  address: string;
  status: TourStatus;
  coverImageUrl?: string;
  roomCount: number;
  scanCount: number;
  viewCount: number;
  leadsCount: number;
  draftChanges: number;
  brandColorHex: string;
  isProtected: boolean;
  publishedAt?: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  tourId: string;
  name: string;
  levelName: string;
  isHidden: boolean;
}

export interface Scan {
  id: string;
  organizationId: string;
  tourId: string;
  roomId: string;
  roomName: string;
  name: string;
  isStartScan: boolean;
  hiddenFromWalkthrough: boolean;
  yaw: number;
  pitch: number;
  hfov: number;
  posX: number;
  posY: number;
  posZ: number;
  imageRes: string;
  checksum?: string | null;
  tileManifest?: TileManifest | null;
  currentTileLevel: number;
  processingStatus: 'ready' | 'uploading' | 'processing' | 'failed';
  originalFile?: File;
  fileUrl?: string;
  fileSizeBytes?: number;
}

export interface Link {
  id: string;
  scanId: string;
  targetScanId: string;
  targetScanName: string;
  yaw: number;
  pitch: number;
  label: string;
  style: LinkStyle;
  autoReturnLink: boolean;
}

export interface ContentItem {
  id: string;
  scanId: string;
  type: ContentType;
  yaw: number;
  pitch: number;
  title: string;
  description: string;
  priceInr?: number | null;
  brand?: string | null;
  dimensions?: string | null;
  whatsappCta: boolean;
}

export interface Lead {
  id: string;
  orgId: string;
  tourId: string;
  tourName: string;
  name: string;
  phone: string;
  email?: string | null;
  message: string;
  productTitle?: string | null;
  roomName?: string | null;
  status: LeadStatus;
  createdAt: string;
}

export interface ProcessingJob {
  id: string;
  tourId: string;
  tourName: string;
  type: string;
  status: JobStatus;
  progress: number;
  step: string;
  attempts: number;
  timestamp: string;
}

export interface SpacingWarning {
  scanNumber: number;
  code: 'TOO_FAR' | 'TOO_CLOSE' | 'ISLAND';
  message: string;
  severity: WarningSeverity;
}
