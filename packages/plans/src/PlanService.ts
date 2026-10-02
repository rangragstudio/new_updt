/**
 * RenderWalk Centralized Plan & Entitlement Service (Phase 1 Step D)
 * Authoritative server-side feature gating, limits, and storage accounting.
 */

export enum PlanCapability {
  TOUR_LIMIT = "TOUR_LIMIT",
  STORAGE_LIMIT = "STORAGE_LIMIT",
  ADVANCED_HOTSPOTS = "ADVANCED_HOTSPOTS",
  FLOOR_PLAN = "FLOOR_PLAN",
  DOLLHOUSE = "DOLLHOUSE",
  CUSTOM_BRANDING = "CUSTOM_BRANDING",
  PASSWORD_PROTECTION = "PASSWORD_PROTECTION",
  CUSTOM_DOMAIN = "CUSTOM_DOMAIN",
  VIDEO_EXPORT = "VIDEO_EXPORT",
  PRESENTATION_MODE = "PRESENTATION_MODE",
  ANALYTICS = "ANALYTICS",
  LEAD_CAPTURE = "LEAD_CAPTURE",
  API_ACCESS = "API_ACCESS"
}

export interface PlanConfig {
  id: string;
  name: "Starter" | "Studio" | "Partner";
  maxActiveTours: number;
  storageLimitGb: number;
  maxScansPerTour: number;
  monthlyInr: number;
  yearlyInr: number;
  capabilities: Set<PlanCapability>;
}

export interface OrgUsageSummary {
  organizationId: string;
  activeToursCount: number;
  storageUsedBytes: number;
  storageUsedGb: number;
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

export class PlanLimitError extends Error {
  constructor(public code: "PLAN_LIMIT_REACHED" | "STORAGE_QUOTA_EXCEEDED" | "FEATURE_NOT_AVAILABLE", message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export class PlanService {
  private static plans: Record<string, PlanConfig> = {
    starter: {
      id: "plan-starter",
      name: "Starter",
      maxActiveTours: 5,
      storageLimitGb: 20.0,
      maxScansPerTour: 40,
      monthlyInr: 999,
      yearlyInr: 9990,
      capabilities: new Set([
        PlanCapability.TOUR_LIMIT,
        PlanCapability.STORAGE_LIMIT,
        PlanCapability.ADVANCED_HOTSPOTS,
        PlanCapability.LEAD_CAPTURE
      ])
    },
    studio: {
      id: "plan-studio",
      name: "Studio",
      maxActiveTours: 25,
      storageLimitGb: 100.0,
      maxScansPerTour: 100,
      monthlyInr: 2999,
      yearlyInr: 29990,
      capabilities: new Set([
        PlanCapability.TOUR_LIMIT,
        PlanCapability.STORAGE_LIMIT,
        PlanCapability.ADVANCED_HOTSPOTS,
        PlanCapability.LEAD_CAPTURE,
        PlanCapability.FLOOR_PLAN,
        PlanCapability.DOLLHOUSE,
        PlanCapability.CUSTOM_BRANDING,
        PlanCapability.PASSWORD_PROTECTION,
        PlanCapability.ANALYTICS,
        PlanCapability.PRESENTATION_MODE
      ])
    },
    partner: {
      id: "plan-partner",
      name: "Partner",
      maxActiveTours: 100,
      storageLimitGb: 500.0,
      maxScansPerTour: 250,
      monthlyInr: 8999,
      yearlyInr: 89990,
      capabilities: new Set(Object.values(PlanCapability))
    }
  };

  static getPlan(planIdOrName: string): PlanConfig {
    const key = planIdOrName.toLowerCase().replace("plan-", "");
    return this.plans[key] || this.plans.studio;
  }

  /**
   * Check feature capability entitlement
   */
  static checkEntitlement(planName: string, capability: PlanCapability): boolean {
    const plan = this.getPlan(planName);
    return plan.capabilities.has(capability);
  }

  /**
   * Authoritative check: can organization create an active tour?
   */
  static assertCanCreateTour(planName: string, currentActiveTours: number): void {
    const plan = this.getPlan(planName);
    if (currentActiveTours >= plan.maxActiveTours) {
      throw new PlanLimitError(
        "PLAN_LIMIT_REACHED",
        `Plan limit reached. Your ${plan.name} plan permits up to ${plan.maxActiveTours} active tours (currently using ${currentActiveTours}). Upgrade to expand limit.`
      );
    }
  }

  /**
   * Authoritative check: can tour add another scan?
   */
  static assertCanAddScan(planName: string, currentTourScans: number): void {
    const plan = this.getPlan(planName);
    if (currentTourScans >= plan.maxScansPerTour) {
      throw new PlanLimitError(
        "PLAN_LIMIT_REACHED",
        `Plan limit reached. Your ${plan.name} plan permits up to ${plan.maxScansPerTour} scans per tour (current: ${currentTourScans}). Upgrade to add more scans.`
      );
    }
  }

  /**
   * Authoritative check: can organization add incoming storage?
   */
  static assertStorageQuota(planName: string, currentStorageBytes: number, incomingBytes: number): void {
    const plan = this.getPlan(planName);
    const maxBytes = plan.storageLimitGb * 1024 * 1024 * 1024;
    if (currentStorageBytes + incomingBytes > maxBytes) {
      throw new PlanLimitError(
        "STORAGE_QUOTA_EXCEEDED",
        `Storage quota exceeded. Your ${plan.name} plan has ${plan.storageLimitGb} GB allocated. Please upgrade storage to upload more assets.`
      );
    }
  }

  /**
   * Reliable organization-level storage accounting (Part 6)
   */
  static calculateStorageAccounting(
    organizationId: string,
    planName: string,
    itemCounts: {
      scansCount: number;
      tiledScansCount: number;
      floorPlansCount: number;
      renderPackagesCount: number;
    }
  ): StorageAccountingBreakdown {
    const plan = this.getPlan(planName);
    const originalUploadsBytes = itemCounts.scansCount * 24 * 1024 * 1024;
    const panoramaTilesBytes = itemCounts.tiledScansCount * 28 * 1024 * 1024;
    const previewAssetsBytes = itemCounts.scansCount * 2 * 1024 * 1024;
    const thumbnailsBytes = itemCounts.scansCount * 200 * 1024;
    const floorPlansBytes = itemCounts.floorPlansCount * 4 * 1024 * 1024;
    const renderPackagesBytes = itemCounts.renderPackagesCount * 18 * 1024 * 1024;

    const totalBytes =
      originalUploadsBytes +
      panoramaTilesBytes +
      previewAssetsBytes +
      thumbnailsBytes +
      floorPlansBytes +
      renderPackagesBytes;

    const quotaBytes = plan.storageLimitGb * 1024 * 1024 * 1024;

    return {
      organizationId,
      originalUploadsBytes,
      panoramaTilesBytes,
      previewAssetsBytes,
      thumbnailsBytes,
      floorPlansBytes,
      renderPackagesBytes,
      totalBytes,
      storageQuotaBytes: quotaBytes,
      storageLimitGb: plan.storageLimitGb,
      isQuotaExceeded: totalBytes > quotaBytes
    };
  }

  /**
   * Authoritative check: can organization use a gated feature?
   */
  static assertFeature(planName: string, capability: PlanCapability, featureName: string): void {
    if (!this.checkEntitlement(planName, capability)) {
      const plan = this.getPlan(planName);
      throw new PlanLimitError(
        "FEATURE_NOT_AVAILABLE",
        `'${featureName}' is not included in the ${plan.name} plan. Upgrade to access this capability.`
      );
    }
  }
}
