// RenderWalk Repository & Business Logic Service
// Ported from RenderWalkRepository.kt and packages/plans/src/PlanService.ts

import {
  Organization,
  User,
  Tour,
  Scan,
  Link,
  ContentItem,
  Lead,
  ProcessingJob,
  FloorPlan,
  CustomDomainConfig,
  NotificationItem,
  PlanDefinition,
  PlanCapability,
  PublishValidationResult,
  PublicTourView,
  PublicScanView,
  StorageAccountingBreakdown,
  TileManifest,
  TileLevel,
  RenderPackage,
  SpacingWarning,
  LeadStatus,
  JobStatus,
  TourStatus,
  WarningSeverity
} from '../types/models';

type Listener = () => void;

class RenderWalkRepositoryStore {
  private listeners: Set<Listener> = new Set();

  private organizations: Organization[] = [
    {
      id: 'org-1',
      name: 'RangRag Architectural Studio',
      industry: 'Architecture & ArchViz',
      brandColorHex: '#D6A77A',
      whatsappNumber: '+91 98250 12345',
      planName: 'Studio Plan',
      storageUsedGb: 22.4,
      storageLimitGb: 100.0,
      activeToursCount: 4,
      maxToursLimit: 25
    },
    {
      id: 'org-2',
      name: 'Atelier Interior Designs',
      industry: 'Luxury Residential Interiors',
      brandColorHex: '#C49A6C',
      whatsappNumber: '+91 98980 67890',
      planName: 'Starter Plan',
      storageUsedGb: 4.2,
      storageLimitGb: 20.0,
      activeToursCount: 2,
      maxToursLimit: 5
    },
    {
      id: 'org-3',
      name: 'Apex Realty Group (White-Label)',
      industry: 'Commercial Real Estate',
      brandColorHex: '#B88A5E',
      whatsappNumber: '+91 94260 55443',
      planName: 'Partner Plan',
      storageUsedGb: 48.0,
      storageLimitGb: 500.0,
      activeToursCount: 12,
      maxToursLimit: 100
    }
  ];

  private currentOrgId: string = 'org-1';

  private currentUser: User = {
    id: 'user-1',
    name: 'Raj Shekhada',
    email: 'raj@renderwalk.com',
    role: 'OWNER',
    avatarInitials: 'RS'
  };

  private tours: Tour[] = [
    {
      id: 'tour-1',
      orgId: 'org-1',
      name: 'Aadhya Luxury Penthouse',
      slug: 'aadhya-luxury-penthouse',
      publicToken: 'aadhya9876543210',
      propertyType: 'Luxury Penthouse',
      address: 'Kalawad Road, Rajkot, Gujarat',
      status: 'PUBLISHED',
      roomCount: 4,
      scanCount: 8,
      viewCount: 612,
      leadsCount: 14,
      draftChanges: 0,
      brandColorHex: '#D6A77A',
      isProtected: false,
      publishedAt: '2 hours ago',
      updatedAt: '25 mins ago'
    },
    {
      id: 'tour-2',
      orgId: 'org-1',
      name: 'The Pavilions Modern Villa',
      slug: 'the-pavilions-villa',
      publicToken: 'pavilions1234567',
      propertyType: 'Modern Villa',
      address: 'Ambica Township, Rajkot',
      status: 'PUBLISHED',
      roomCount: 6,
      scanCount: 14,
      viewCount: 428,
      leadsCount: 7,
      draftChanges: 2,
      brandColorHex: '#D6A77A',
      isProtected: true,
      publishedAt: 'Yesterday',
      updatedAt: 'Yesterday'
    },
    {
      id: 'tour-3',
      orgId: 'org-1',
      name: 'Heritage Haveli Restoration',
      slug: 'heritage-haveli-restoration',
      publicToken: 'haveli3334445556',
      propertyType: 'Heritage Architecture',
      address: 'Gondal Palace Road, Gujarat',
      status: 'PROCESSING',
      roomCount: 5,
      scanCount: 11,
      viewCount: 0,
      leadsCount: 0,
      draftChanges: 0,
      brandColorHex: '#D6A77A',
      isProtected: false,
      updatedAt: '1 hour ago'
    },
    {
      id: 'tour-4',
      orgId: 'org-1',
      name: 'Minimalist Studio Apartment',
      slug: 'minimalist-studio-apt',
      publicToken: 'minimalist778899',
      propertyType: 'Studio Apartment',
      address: 'Nana Mava Road, Rajkot',
      status: 'DRAFT',
      roomCount: 2,
      scanCount: 4,
      viewCount: 45,
      leadsCount: 1,
      draftChanges: 5,
      brandColorHex: '#D6A77A',
      isProtected: false,
      updatedAt: '3 days ago'
    },
    {
      id: 'tour-5',
      orgId: 'org-2',
      name: 'Emerald Heights Duplex',
      slug: 'emerald-heights-duplex',
      publicToken: 'emerald222333444',
      propertyType: 'Duplex Home',
      address: 'Ahmedabad Highway, Gujarat',
      status: 'PUBLISHED',
      roomCount: 4,
      scanCount: 7,
      viewCount: 189,
      leadsCount: 4,
      draftChanges: 0,
      brandColorHex: '#C49A6C',
      isProtected: false,
      publishedAt: '4 days ago',
      updatedAt: '4 days ago'
    }
  ];

  private scans: Scan[] = [
    {
      id: 'scan-1',
      organizationId: 'org-1',
      tourId: 'tour-1',
      roomId: 'room-1',
      roomName: 'Grand Living Hall',
      name: 'Living Room Entrance',
      isStartScan: true,
      hiddenFromWalkthrough: false,
      yaw: 15,
      pitch: -2,
      hfov: 90,
      posX: 0,
      posY: 0,
      posZ: 1.5,
      imageRes: '8192 × 4096 (8K)',
      currentTileLevel: 4,
      processingStatus: 'ready',
      tileManifest: this.generateTileManifest('org-1', 'tour-1', 'scan-1', 8192, 4096)
    },
    {
      id: 'scan-2',
      organizationId: 'org-1',
      tourId: 'tour-1',
      roomId: 'room-1',
      roomName: 'Grand Living Hall',
      name: 'Lounge & Seating Area',
      isStartScan: false,
      hiddenFromWalkthrough: false,
      yaw: 45,
      pitch: 0,
      hfov: 90,
      posX: 2.4,
      posY: 0.5,
      posZ: 1.5,
      imageRes: '8192 × 4096 (8K)',
      currentTileLevel: 4,
      processingStatus: 'ready',
      tileManifest: this.generateTileManifest('org-1', 'tour-1', 'scan-2', 8192, 4096)
    },
    {
      id: 'scan-3',
      organizationId: 'org-1',
      tourId: 'tour-1',
      roomId: 'room-2',
      roomName: 'Designer Dining Space',
      name: 'Dining Center',
      isStartScan: false,
      hiddenFromWalkthrough: false,
      yaw: -30,
      pitch: -4,
      hfov: 90,
      posX: 4.8,
      posY: 1.2,
      posZ: 1.5,
      imageRes: '8192 × 4096 (8K)',
      currentTileLevel: 4,
      processingStatus: 'ready',
      tileManifest: this.generateTileManifest('org-1', 'tour-1', 'scan-3', 8192, 4096)
    },
    {
      id: 'scan-4',
      organizationId: 'org-1',
      tourId: 'tour-1',
      roomId: 'room-3',
      roomName: 'Italian Modular Kitchen',
      name: 'Island Counter',
      isStartScan: false,
      hiddenFromWalkthrough: false,
      yaw: 90,
      pitch: -5,
      hfov: 90,
      posX: 7.1,
      posY: 2.0,
      posZ: 1.5,
      imageRes: '8192 × 4096 (8K)',
      currentTileLevel: 4,
      processingStatus: 'ready',
      tileManifest: this.generateTileManifest('org-1', 'tour-1', 'scan-4', 8192, 4096)
    },
    {
      id: 'scan-5',
      organizationId: 'org-1',
      tourId: 'tour-1',
      roomId: 'room-4',
      roomName: 'Master Bedroom',
      name: 'Bed Facing View',
      isStartScan: false,
      hiddenFromWalkthrough: false,
      yaw: 120,
      pitch: 0,
      hfov: 90,
      posX: 3.0,
      posY: 5.2,
      posZ: 1.5,
      imageRes: '8192 × 4096 (8K)',
      currentTileLevel: 4,
      processingStatus: 'ready',
      tileManifest: this.generateTileManifest('org-1', 'tour-1', 'scan-5', 8192, 4096)
    }
  ];

  private links: Link[] = [
    {
      id: 'link-1',
      scanId: 'scan-1',
      targetScanId: 'scan-2',
      targetScanName: 'Lounge & Seating Area',
      yaw: 45,
      pitch: -12,
      label: 'Walk to Lounge',
      style: 'FLOOR_RING',
      autoReturnLink: true
    },
    {
      id: 'link-2',
      scanId: 'scan-2',
      targetScanId: 'scan-1',
      targetScanName: 'Living Room Entrance',
      yaw: -135,
      pitch: -12,
      label: 'Back to Entrance',
      style: 'FLOOR_RING',
      autoReturnLink: true
    },
    {
      id: 'link-3',
      scanId: 'scan-2',
      targetScanId: 'scan-3',
      targetScanName: 'Designer Dining Space',
      yaw: 85,
      pitch: -10,
      label: 'Go to Dining',
      style: 'FLOOR_RING',
      autoReturnLink: true
    },
    {
      id: 'link-4',
      scanId: 'scan-3',
      targetScanId: 'scan-4',
      targetScanName: 'Italian Modular Kitchen',
      yaw: 60,
      pitch: -8,
      label: 'Open Kitchen',
      style: 'FLOOR_RING',
      autoReturnLink: true
    }
  ];

  private contentItems: ContentItem[] = [
    {
      id: 'item-1',
      scanId: 'scan-2',
      type: 'PRODUCT',
      yaw: 62,
      pitch: -8,
      title: 'Artisan Teakwood Italian Sofa',
      description: 'Handcrafted top-grain Italian leather 3-seater with Burma teak frame and brushed brass legs.',
      priceInr: 145000,
      brand: 'Atelier Bespoke Furnishings',
      dimensions: '88"W × 38"D × 32"H',
      whatsappCta: true
    },
    {
      id: 'item-2',
      scanId: 'scan-3',
      type: 'PRODUCT',
      yaw: -25,
      pitch: -14,
      title: 'Statuario Marble 8-Seater Dining',
      description: 'Seamless Italian Statuario marble tabletop with chamfered edge and solid brass base.',
      priceInr: 210000,
      brand: 'RangRag Natural Stones',
      dimensions: '96"L × 44"W × 30"H',
      whatsappCta: true
    },
    {
      id: 'item-3',
      scanId: 'scan-4',
      type: 'INFO',
      yaw: 110,
      pitch: -2,
      title: 'Quartz Worktop & Concealed Chimney',
      description: 'Stain-resistant engineered quartz with smart touchless induction hob and soft-close Blum hinges.',
      whatsappCta: false
    }
  ];

  private leads: Lead[] = [
    {
      id: 'lead-1',
      orgId: 'org-1',
      tourId: 'tour-1',
      tourName: 'Aadhya Luxury Penthouse',
      name: 'Harshil Patel',
      phone: '+91 98981 12345',
      email: 'harshil.p@outlook.com',
      message: 'Interested in purchasing the Artisan Teakwood Italian Sofa shown in the living room.',
      productTitle: 'Artisan Teakwood Italian Sofa',
      roomName: 'Grand Living Hall',
      status: 'NEW',
      createdAt: '10 mins ago'
    },
    {
      id: 'lead-2',
      orgId: 'org-1',
      tourId: 'tour-1',
      tourName: 'Aadhya Luxury Penthouse',
      name: 'Bhavin Shah',
      phone: '+91 97240 88776',
      email: 'bhavin@shahbuilders.in',
      message: 'Would like to book a site visit this Saturday afternoon.',
      productTitle: null,
      roomName: 'Entire Penthouse',
      status: 'CONTACTED',
      createdAt: 'Yesterday'
    },
    {
      id: 'lead-3',
      orgId: 'org-1',
      tourId: 'tour-2',
      tourName: 'The Pavilions Modern Villa',
      name: 'Meera Trivedi',
      phone: '+91 94280 33441',
      email: 'meera.trivedi@gmail.com',
      message: 'Can we get custom dimensions for the Statuario Dining Table?',
      productTitle: 'Statuario Marble 8-Seater Dining',
      roomName: 'Designer Dining Space',
      status: 'QUALIFIED',
      createdAt: '2 days ago'
    }
  ];

  private processingJobs: ProcessingJob[] = [
    {
      id: 'job-101',
      tourId: 'tour-3',
      tourName: 'Heritage Haveli Restoration',
      type: 'MULTIRES_TILES',
      status: 'RUNNING',
      progress: 72,
      step: 'Generating level 2048 & 4096 cube tiles',
      attempts: 1,
      timestamp: 'Running · 3m elapsed'
    },
    {
      id: 'job-102',
      tourId: 'tour-1',
      tourName: 'Aadhya Luxury Penthouse',
      type: 'ALIGNMENT_SPATIAL',
      status: 'DONE',
      progress: 100,
      step: 'All 8 scans aligned; dollhouse ready',
      attempts: 1,
      timestamp: 'Completed 1h ago'
    }
  ];

  private floorPlans: FloorPlan[] = [
    {
      id: 'plan-1',
      tourId: 'tour-1',
      levelName: 'Ground Floor',
      title: 'Penthouse Level 1 Architectural Layout',
      format: 'PNG',
      imageUrl: '',
      pins: [
        {
          id: 'pin-1',
          scanId: 'scan-1',
          scanName: 'Living Room Entrance',
          x: 0.25,
          y: 0.35,
          headingDeg: 15,
          levelName: 'Ground Floor'
        },
        {
          id: 'pin-2',
          scanId: 'scan-2',
          scanName: 'Lounge & Seating Area',
          x: 0.42,
          y: 0.38,
          headingDeg: 45,
          levelName: 'Ground Floor'
        },
        {
          id: 'pin-3',
          scanId: 'scan-3',
          scanName: 'Dining Center',
          x: 0.65,
          y: 0.45,
          headingDeg: -30,
          levelName: 'Ground Floor'
        }
      ]
    }
  ];

  private notifications: NotificationItem[] = [
    {
      id: 'notif-1',
      orgId: 'org-1',
      type: 'TOUR_PUBLISHED',
      title: 'Aadhya Penthouse Published',
      message: 'Tour is live on CDN at /t/aadhya-luxury-penthouse',
      createdAt: 'Just now'
    }
  ];

  private customDomains: CustomDomainConfig[] = [
    {
      id: 'dom-1',
      orgId: 'org-1',
      hostname: 'tours.rangragstudio.com',
      status: 'verified',
      sslActive: true,
      cnameTarget: 'cname.renderwalk.com'
    }
  ];

  private importedDatasetHashes: Set<string> = new Set();

  public readonly plans: Record<string, PlanDefinition> = {
    starter: {
      id: 'plan-starter',
      name: 'Starter',
      maxActiveTours: 5,
      storageLimitGb: 20.0,
      maxScansPerTour: 40,
      monthlyPriceInr: 999,
      yearlyPriceInr: 9990,
      capabilities: new Set([
        PlanCapability.TOUR_LIMIT,
        PlanCapability.STORAGE_LIMIT,
        PlanCapability.ADVANCED_HOTSPOTS,
        PlanCapability.LEAD_CAPTURE
      ])
    },
    studio: {
      id: 'plan-studio',
      name: 'Studio',
      maxActiveTours: 25,
      storageLimitGb: 100.0,
      maxScansPerTour: 100,
      monthlyPriceInr: 2999,
      yearlyPriceInr: 29990,
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
      id: 'plan-partner',
      name: 'Partner',
      maxActiveTours: 100,
      storageLimitGb: 500.0,
      maxScansPerTour: 250,
      monthlyPriceInr: 8999,
      yearlyPriceInr: 89990,
      capabilities: new Set(Object.values(PlanCapability))
    }
  };

  // Subscribe to changes
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // Multi-tenant Org Accessors
  public getOrganizations(): Organization[] {
    return this.organizations;
  }

  public getCurrentOrgId(): string {
    return this.currentOrgId;
  }

  public getCurrentOrg(): Organization {
    return (
      this.organizations.find((o) => o.id === this.currentOrgId) ||
      this.organizations[0]
    );
  }

  public getCurrentUser(): User {
    return this.currentUser;
  }

  public switchOrganization(orgId: string): void {
    if (this.organizations.some((o) => o.id === orgId)) {
      this.currentOrgId = orgId;
      this.notify();
    }
  }

  public updateOrganization(updates: Partial<Organization>): void {
    this.organizations = this.organizations.map((org) =>
      org.id === this.currentOrgId ? { ...org, ...updates } : org
    );
    this.notify();
  }

  // Plan System & Gating
  public getPlanForCurrentOrg(): PlanDefinition {
    const org = this.getCurrentOrg();
    const key = org.planName.toLowerCase().replace(' plan', '');
    return this.plans[key] || this.plans.studio;
  }

  public checkEntitlement(capability: PlanCapability): boolean {
    return this.getPlanForCurrentOrg().capabilities.has(capability);
  }

  public assertCanCreateTour(): void {
    const plan = this.getPlanForCurrentOrg();
    const activeCount = this.tours.filter(
      (t) => t.orgId === this.currentOrgId && t.status !== 'ARCHIVED'
    ).length;
    if (activeCount >= plan.maxActiveTours) {
      this.sendNotification(
        'PLAN_LIMIT_REACHED',
        'Tour Limit Reached',
        `Your studio has reached the limit of ${plan.maxActiveTours} active tours on the ${plan.name} plan.`
      );
      throw new Error(
        `PLAN_LIMIT_REACHED: Your ${plan.name} plan permits up to ${plan.maxActiveTours} active tours. Upgrade to create more.`
      );
    }
  }

  public assertCanAddScanToTour(tourId: string): void {
    const plan = this.getPlanForCurrentOrg();
    const currentScanCount = this.scans.filter((s) => s.tourId === tourId).length;
    if (currentScanCount >= plan.maxScansPerTour) {
      this.sendNotification(
        'PLAN_LIMIT_REACHED',
        'Tour Scan Limit Reached',
        `Your ${plan.name} plan permits up to ${plan.maxScansPerTour} scans per tour. Current tour has ${currentScanCount}.`
      );
      throw new Error(
        `PLAN_LIMIT_REACHED: Your ${plan.name} plan permits up to ${plan.maxScansPerTour} scans per tour. Upgrade to expand limits.`
      );
    }
  }

  public assertCanUseFeature(capability: PlanCapability, featureName: string): void {
    if (!this.checkEntitlement(capability)) {
      const plan = this.getPlanForCurrentOrg();
      throw new Error(
        `FEATURE_NOT_AVAILABLE: '${featureName}' is not included in the ${plan.name} plan. Upgrade to unlock.`
      );
    }
  }

  // Storage Accounting
  public getStorageAccounting(orgId: string = this.currentOrgId): StorageAccountingBreakdown {
    const org = this.organizations.find((o) => o.id === orgId) || this.organizations[0];
    const planKey = org.planName.toLowerCase().replace(' plan', '');
    const plan = this.plans[planKey] || this.plans.studio;
    const orgTours = this.tours.filter((t) => t.orgId === orgId);
    const tourIds = new Set(orgTours.map((t) => t.id));
    const orgScans = this.scans.filter((s) => tourIds.has(s.tourId));
    const orgFloorPlans = this.floorPlans.filter((fp) => tourIds.has(fp.tourId));

    const originalUploadsBytes = orgScans.length * 24 * 1024 * 1024;
    const panoramaTilesBytes = orgScans.length * 28 * 1024 * 1024;
    const previewAssetsBytes = orgScans.length * 2 * 1024 * 1024;
    const thumbnailsBytes = orgScans.length * 200 * 1024;
    const floorPlansBytes = orgFloorPlans.length * 4 * 1024 * 1024;
    const renderPackagesBytes = orgScans.some((s) => s.checksum) ? 18 * 1024 * 1024 : 0;

    const totalBytes =
      originalUploadsBytes +
      panoramaTilesBytes +
      previewAssetsBytes +
      thumbnailsBytes +
      floorPlansBytes +
      renderPackagesBytes;
    const quotaBytes = plan.storageLimitGb * 1024 * 1024 * 1024;

    return {
      organizationId: orgId,
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

  public calculateOrgStorageBytes(orgId: string = this.currentOrgId): number {
    return this.getStorageAccounting(orgId).totalBytes;
  }

  public reconcileStorage(orgId: string = this.currentOrgId): StorageAccountingBreakdown {
    const breakdown = this.getStorageAccounting(orgId);
    const usedGb = breakdown.totalBytes / (1024 * 1024 * 1024);
    const roundedGb = Math.round(usedGb * 10) / 10;
    this.organizations = this.organizations.map((org) =>
      org.id === orgId ? { ...org, storageUsedGb: roundedGb } : org
    );
    this.notify();
    return breakdown;
  }

  // Tours
  public getTours(): Tour[] {
    return this.tours;
  }

  public getTour(id: string): Tour | undefined {
    return this.tours.find((t) => t.id === id);
  }

  public assertCanAccessTour(tourId: string): void {
    const tour = this.tours.find((t) => t.id === tourId);
    if (!tour) throw new Error(`Tour not found: ${tourId}`);
    if (tour.orgId !== this.currentOrgId) {
      throw new Error(
        `Cross-tenant authorization violation: Organization '${this.currentOrgId}' cannot access tour belonging to '${tour.orgId}'`
      );
    }
  }

  public createTour(name: string, propertyType: string, address: string): Tour {
    this.assertCanCreateTour();
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const newTour: Tour = {
      id: `tour-${Date.now()}`,
      orgId: this.currentOrgId,
      name,
      slug,
      publicToken: Math.random().toString(36).substring(2, 18),
      propertyType,
      address,
      status: 'DRAFT',
      roomCount: 0,
      scanCount: 0,
      viewCount: 0,
      leadsCount: 0,
      draftChanges: 0,
      brandColorHex: this.getCurrentOrg().brandColorHex,
      isProtected: false,
      updatedAt: 'Just now'
    };
    this.tours = [newTour, ...this.tours];
    this.notify();
    return newTour;
  }

  public validateForPublishing(tourId: string): PublishValidationResult {
    const tour = this.tours.find((t) => t.id === tourId);
    if (!tour) {
      return { isValid: false, errors: ['Tour not found'], warnings: [] };
    }

    const tourScans = this.scans.filter((s) => s.tourId === tour.id);
    const errors: string[] = [];

    if (tourScans.length === 0) {
      errors.push('Tour has no scans. Add at least one 360° panorama scan.');
    }

    const startScan = tourScans.find((s) => s.isStartScan);
    if (!startScan && tourScans.length > 0) {
      errors.push('No starting scan selected. Designate a start scan.');
    } else if (startScan && startScan.hiddenFromWalkthrough) {
      errors.push(
        `Designated starting scan '${startScan.name}' is hidden from walkthrough. Unhide scan or pick another start scan.`
      );
    }

    const processingScans = tourScans.filter(
      (s) => s.processingStatus === 'uploading' || s.processingStatus === 'processing'
    );
    if (processingScans.length > 0) {
      errors.push(`${processingScans.length} scan(s) are still processing panorama tiles.`);
    }

    const failedScans = tourScans.filter((s) => s.processingStatus === 'failed');
    if (failedScans.length > 0) {
      errors.push(`${failedScans.length} scan(s) encountered processing errors. Reprocess before publishing.`);
    }

    const missingManifests = tourScans.filter((s) => !s.tileManifest);
    if (missingManifests.length > 0) {
      errors.push(`${missingManifests.length} scan(s) are missing multi-resolution tile manifests.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  public publishTour(tourId: string): [boolean, string[]] {
    this.assertCanAccessTour(tourId);
    const validation = this.validateForPublishing(tourId);
    if (!validation.isValid) {
      return [false, validation.errors];
    }

    const tour = this.tours.find((t) => t.id === tourId)!;
    this.tours = this.tours.map((t) =>
      t.id === tourId
        ? {
            ...t,
            status: 'PUBLISHED' as TourStatus,
            publishedAt: 'Just now',
            draftChanges: 0,
            updatedAt: 'Just now'
          }
        : t
    );

    this.sendNotification(
      'TOUR_PUBLISHED',
      'Tour Published Live',
      `'${tour.name}' is now live on the public CDN. Public link: https://renderwalk.com/t/${tour.slug}`
    );

    this.notify();
    return [true, []];
  }

  public unpublishTour(tourId: string): void {
    this.assertCanAccessTour(tourId);
    this.tours = this.tours.map((t) =>
      t.id === tourId
        ? { ...t, status: 'UNPUBLISHED' as TourStatus, updatedAt: 'Just now' }
        : t
    );
    this.notify();
  }

  public updateTour(tourId: string, updates: Partial<Tour>): void {
    this.tours = this.tours.map((t) =>
      t.id === tourId ? { ...t, ...updates, updatedAt: 'Just now' } : t
    );
    this.notify();
  }

  public deleteTour(tourId: string): void {
    this.tours = this.tours.filter((t) => t.id !== tourId);
    this.scans = this.scans.filter((s) => s.tourId !== tourId);
    this.notify();
  }

  public duplicateTour(tourId: string): void {
    const existing = this.tours.find((t) => t.id === tourId);
    if (!existing) return;
    const newId = `tour-${Date.now()}`;
    const duplicate: Tour = {
      ...existing,
      id: newId,
      name: `${existing.name} (Copy)`,
      slug: `${existing.slug}-copy`,
      status: 'DRAFT',
      updatedAt: 'Just now'
    };
    this.tours = [duplicate, ...this.tours];

    // Duplicate scans as well
    const existingScans = this.scans.filter((s) => s.tourId === tourId);
    const newScans = existingScans.map((s, idx) => ({
      ...s,
      id: `scan-${newId}-${idx}`,
      tourId: newId
    }));
    this.scans = [...this.scans, ...newScans];
    this.notify();
  }

  // Public visitor tour access
  public getPublicTour(slugOrToken: string): PublicTourView | null {
    const tour = this.tours.find(
      (t) =>
        (t.slug === slugOrToken || t.publicToken === slugOrToken) &&
        t.status === 'PUBLISHED'
    );
    if (!tour) return null;

    const visibleScans = this.scans.filter(
      (s) => s.tourId === tour.id && !s.hiddenFromWalkthrough
    );
    const scanIds = new Set(visibleScans.map((s) => s.id));
    const links = this.links.filter((l) => scanIds.has(l.scanId));
    const content = this.contentItems.filter((c) => scanIds.has(c.scanId));
    const startScan = visibleScans.find((s) => s.isStartScan) || visibleScans[0];

    const publicScans: PublicScanView[] = visibleScans.map((s) => ({
      id: s.id,
      name: s.name,
      roomName: s.roomName,
      isStartScan: s.isStartScan,
      yaw: s.yaw,
      pitch: s.pitch,
      hfov: s.hfov,
      tileManifest: s.tileManifest
    }));

    return {
      publicSlug: tour.slug,
      publicToken: tour.publicToken,
      tourName: tour.name,
      propertyType: tour.propertyType,
      address: tour.address,
      brandColorHex: tour.brandColorHex,
      startScanId: startScan ? startScan.id : '',
      scans: publicScans,
      links,
      contentItems: content,
      isProtected: tour.isProtected
    };
  }

  // Scans
  public getScans(): Scan[] {
    return this.scans;
  }

  public getTourScans(tourId: string): Scan[] {
    return this.scans.filter((s) => s.tourId === tourId);
  }

  public addScanToTour(
    tourId: string,
    roomName: string,
    scanName: string,
    posX: number,
    posY: number,
    attachManifest: boolean = true
  ): Scan {
    this.assertCanAddScanToTour(tourId);
    const existing = this.scans.filter((s) => s.tourId === tourId);
    const isFirst = existing.length === 0;
    const scanId = `scan-${Math.random().toString(36).substring(2, 9)}`;

    const newScan: Scan = {
      id: scanId,
      organizationId: this.currentOrgId,
      tourId,
      roomId: `room-${Date.now()}`,
      roomName,
      name: scanName,
      isStartScan: isFirst,
      hiddenFromWalkthrough: false,
      yaw: 0,
      pitch: 0,
      hfov: 90,
      posX,
      posY,
      posZ: 1.5,
      imageRes: '8192 × 4096 (8K)',
      processingStatus: 'ready',
      currentTileLevel: 4,
      tileManifest: attachManifest
        ? this.generateTileManifest(this.currentOrgId, tourId, scanId, 8192, 4096)
        : null
    };

    this.scans = [...this.scans, newScan];
    this.tours = this.tours.map((t) =>
      t.id === tourId
        ? { ...t, scanCount: t.scanCount + 1, draftChanges: t.draftChanges + 1 }
        : t
    );
    this.notify();
    return newScan;
  }

  public toggleHideScan(scanId: string): void {
    this.scans = this.scans.map((s) =>
      s.id === scanId ? { ...s, hiddenFromWalkthrough: !s.hiddenFromWalkthrough } : s
    );
    this.notify();
  }

  public setStartScan(scanId: string, tourId: string): void {
    this.scans = this.scans.map((s) =>
      s.tourId === tourId ? { ...s, isStartScan: s.id === scanId } : s
    );
    this.notify();
  }

  public updateScan(scanId: string, updates: Partial<Scan>): void {
    this.scans = this.scans.map((s) => (s.id === scanId ? { ...s, ...updates } : s));
    this.notify();
  }

  // Links (Navigation Hotspots)
  public getLinks(): Link[] {
    return this.links;
  }

  public addLink(
    scanId: string,
    targetScanId: string,
    targetScanName: string,
    yaw: number,
    pitch: number,
    label: string
  ): Link {
    const newLink: Link = {
      id: `link-${Date.now()}`,
      scanId,
      targetScanId,
      targetScanName,
      yaw,
      pitch,
      label,
      style: 'FLOOR_RING',
      autoReturnLink: true
    };
    this.links = [...this.links, newLink];
    this.notify();
    return newLink;
  }

  public removeLink(linkId: string): void {
    this.links = this.links.filter((l) => l.id !== linkId);
    this.notify();
  }

  // Content Items & POIs
  public getContentItems(): ContentItem[] {
    return this.contentItems;
  }

  public addProductCard(
    scanId: string,
    yaw: number,
    pitch: number,
    title: string,
    priceInr: number,
    description: string,
    brand?: string,
    dimensions?: string
  ): ContentItem {
    const newItem: ContentItem = {
      id: `item-${Date.now()}`,
      scanId,
      type: 'PRODUCT',
      yaw,
      pitch,
      title,
      description,
      priceInr,
      brand: brand || null,
      dimensions: dimensions || null,
      whatsappCta: true
    };
    this.contentItems = [...this.contentItems, newItem];
    this.notify();
    return newItem;
  }

  public removeContentItem(itemId: string): void {
    this.contentItems = this.contentItems.filter((i) => i.id !== itemId);
    this.notify();
  }

  // Leads
  public getLeads(): Lead[] {
    return this.leads;
  }

  public updateLeadStatus(leadId: string, newStatus: LeadStatus): void {
    this.leads = this.leads.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l));
    this.notify();
  }

  public submitLead(
    tourId: string,
    tourName: string,
    name: string,
    phone: string,
    message: string,
    product?: string,
    email?: string
  ): Lead {
    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      orgId: this.currentOrgId,
      tourId,
      tourName,
      name,
      phone,
      email: email || null,
      message,
      productTitle: product || null,
      status: 'NEW',
      createdAt: 'Just now'
    };
    this.leads = [newLead, ...this.leads];
    this.tours = this.tours.map((t) =>
      t.id === tourId ? { ...t, leadsCount: t.leadsCount + 1 } : t
    );
    this.notify();
    return newLead;
  }

  // Processing Jobs
  public getJobs(): ProcessingJob[] {
    return this.processingJobs;
  }

  public triggerPanoramaProcessing(tourId: string, scanId: string, scanName: string): void {
    const tour = this.tours.find((t) => t.id === tourId);
    const newJob: ProcessingJob = {
      id: `job-${Math.random().toString(36).substring(2, 9)}`,
      tourId,
      tourName: tour?.name || 'Virtual Tour',
      type: 'PANORAMA_PROCESS',
      status: 'RUNNING',
      progress: 65,
      step: 'Building 8K multi-resolution cube tiles & manifest',
      attempts: 1,
      timestamp: 'Just now'
    };
    this.processingJobs = [newJob, ...this.processingJobs];

    const manifest = this.generateTileManifest(this.currentOrgId, tourId, scanId, 8192, 4096);
    this.scans = this.scans.map((s) =>
      s.id === scanId
        ? { ...s, tileManifest: manifest, processingStatus: 'ready' as const }
        : s
    );
    this.notify();
  }

  public retryJob(jobId: string): void {
    this.processingJobs = this.processingJobs.map((j) =>
      j.id === jobId
        ? {
            ...j,
            status: 'RUNNING' as JobStatus,
            progress: 15,
            step: 'Restarting tiling pipeline...',
            attempts: j.attempts + 1
          }
        : j
    );
    this.notify();
  }

  // Floor Plans
  public getFloorPlans(): FloorPlan[] {
    return this.floorPlans;
  }

  public addFloorPlan(tourId: string, levelName: string, title: string, format: string = 'PNG'): FloorPlan {
    const newPlan: FloorPlan = {
      id: `plan-${Date.now()}`,
      tourId,
      levelName,
      title,
      format,
      pins: []
    };
    this.floorPlans = [...this.floorPlans, newPlan];
    this.notify();
    return newPlan;
  }

  public addOrUpdateFloorPlanPin(
    floorPlanId: string,
    scanId: string,
    scanName: string,
    x: number,
    y: number,
    headingDeg: number
  ): void {
    this.floorPlans = this.floorPlans.map((plan) => {
      if (plan.id === floorPlanId) {
        const remaining = plan.pins.filter((p) => p.scanId !== scanId);
        const newPin = {
          id: `pin-${Date.now()}`,
          scanId,
          scanName,
          x: Math.max(0.05, Math.min(0.95, x)),
          y: Math.max(0.05, Math.min(0.95, y)),
          headingDeg,
          levelName: plan.levelName
        };
        return { ...plan, pins: [...remaining, newPin] };
      }
      return plan;
    });
    this.notify();
  }

  // Notifications
  public getNotifications(): NotificationItem[] {
    return this.notifications;
  }

  public sendNotification(type: string, title: string, message: string): void {
    const notif: NotificationItem = {
      id: `notif-${Date.now()}`,
      orgId: this.currentOrgId,
      type,
      title,
      message,
      createdAt: 'Just now'
    };
    this.notifications = [notif, ...this.notifications];
    this.notify();
  }

  // Custom Domains
  public getCustomDomains(): CustomDomainConfig[] {
    return this.customDomains;
  }

  public registerCustomDomain(hostname: string): CustomDomainConfig {
    this.assertCanUseFeature(PlanCapability.CUSTOM_DOMAIN, 'Custom Domain');
    const clean = hostname.trim().toLowerCase().replace(/^https?:\/\//, '');
    const config: CustomDomainConfig = {
      id: `dom-${Date.now()}`,
      orgId: this.currentOrgId,
      hostname: clean,
      status: 'pending',
      sslActive: false,
      cnameTarget: 'cname.renderwalk.com'
    };
    this.customDomains = [
      ...this.customDomains.filter((d) => d.orgId !== this.currentOrgId),
      config
    ];
    this.notify();
    return config;
  }

  public verifyCustomDomain(hostname: string): boolean {
    const clean = hostname.trim().toLowerCase().replace(/^https?:\/\//, '');
    let success = false;
    this.customDomains = this.customDomains.map((d) => {
      if (d.hostname === clean && d.orgId === this.currentOrgId) {
        success = true;
        return { ...d, status: 'verified', sslActive: true };
      }
      return d;
    });
    this.notify();
    return success;
  }

  // Spacing Rules Engine
  public evaluateScanSpacing(scansList: Scan[]): SpacingWarning[] {
    const warnings: SpacingWarning[] = [];
    for (let i = 1; i < scansList.length; i++) {
      const prev = scansList[i - 1];
      const curr = scansList[i];
      const dx = curr.posX - prev.posX;
      const dy = curr.posY - prev.posY;
      const distanceMeters = Math.sqrt(dx * dx + dy * dy);
      const distanceFeet = distanceMeters * 3.28084;

      if (distanceMeters > 3.0) {
        warnings.push({
          scanNumber: i + 1,
          code: 'TOO_FAR',
          message: `Scan ${i + 1} is ${distanceFeet.toFixed(1)} ft (${distanceMeters.toFixed(1)}m) from Scan ${i}. Recommended spacing is 7–10 ft (2–3m). Add a scan in between.`,
          severity: 'WARNING'
        });
      } else if (distanceMeters < 0.9 && distanceMeters > 0.01) {
        warnings.push({
          scanNumber: i + 1,
          code: 'TOO_CLOSE',
          message: `Scan ${i + 1} and Scan ${i} are very close (${distanceFeet.toFixed(1)} ft). One of them may be redundant.`,
          severity: 'INFO'
        });
      }
    }
    return warnings;
  }

  // Render Package Import
  public importRenderPackage(pkg: RenderPackage): [boolean, string] {
    if (this.importedDatasetHashes.has(pkg.checksum)) {
      return [
        false,
        'Duplicate dataset: This project render package has already been imported.'
      ];
    }

    const newTour = this.createTour(
      pkg.name,
      'Imported Architectural Project',
      'ArchViz Render Import'
    );

    pkg.scans.forEach((scanItem, index) => {
      const scan: Scan = {
        id: `scan-${newTour.id}-${index}`,
        organizationId: this.currentOrgId,
        tourId: newTour.id,
        roomId: `room-${scanItem.room.replace(/\s+/g, '-').toLowerCase()}`,
        roomName: scanItem.room,
        name: scanItem.id,
        isStartScan: index === 0,
        hiddenFromWalkthrough: false,
        yaw: scanItem.rotationYaw,
        pitch: 0,
        hfov: 90,
        posX: scanItem.posX,
        posY: scanItem.posY,
        posZ: scanItem.posZ || 1.5,
        imageRes: '8192 × 4096 (8K)',
        checksum: `${pkg.checksum}-${index}`,
        currentTileLevel: 4,
        processingStatus: 'ready',
        tileManifest: this.generateTileManifest(
          this.currentOrgId,
          newTour.id,
          `scan-${index}`,
          8192,
          4096
        )
      };
      this.scans = [...this.scans, scan];
    });

    this.importedDatasetHashes.add(pkg.checksum);
    this.notify();
    return [true, `Successfully imported ${pkg.scans.length} scans for '${pkg.name}'`];
  }

  // Helper: Tile Manifest Generator
  public generateTileManifest(
    orgId: string,
    tourId: string,
    scanId: string,
    width: number,
    height: number
  ): TileManifest {
    const tileSize = 512;
    const temp: [number, number][] = [];
    let currW = width;
    let currH = height;

    while (currW >= tileSize) {
      temp.push([currW, currH]);
      currW = Math.floor(currW / 2);
      currH = Math.floor(currH / 2);
    }

    const levels: TileLevel[] = temp.reverse().map(([w, h], idx) => ({
      level: idx,
      width: w,
      height: h,
      tilesX: Math.ceil(w / tileSize),
      tilesY: Math.ceil(h / tileSize),
      tileSize
    }));

    return {
      projection: 'equirectangular',
      width,
      height,
      tileSize,
      levels,
      previewUrl: `organizations/${orgId}/tours/${tourId}/scans/${scanId}/previews/preview.jpg`,
      thumbnailUrl: `organizations/${orgId}/tours/${tourId}/scans/${scanId}/previews/thumb.webp`
    };
  }
}

export const repository = new RenderWalkRepositoryStore();
