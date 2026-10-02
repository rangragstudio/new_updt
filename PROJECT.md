# RenderWalk — Master Architecture, Technical Specification & Blueprint

**Product Name:** RenderWalk  
**Status:** Phase 0 (Foundation) & Phase 1 (Web Core / Manual Tours)  
**Classification:** Production SaaS Architecture Specification  
**Design Identity:** Warm Dark Architectural Visual Language  

---

## 1. Executive Summary & Product Vision

RenderWalk is a next-generation 360° virtual tour and spatial walkthrough SaaS platform targeted at architects, interior designers, ArchViz studios, real-estate firms, builders, and 360° photographers.

### Core User Journey
1. **Sign Up & Onboard:** Account creation, organization configuration, branding palette setup (warm brass accent `#D6A77A`, custom logo, WhatsApp enquiry number).
2. **Create Tour:** Property name, classification, address, initial brand kit selection.
3. **Add Scans:** Resumable batch upload of 360° equirectangular panoramas (JPG/PNG/WebP, 2:1 ratio) or architectural render packages with camera metadata.
4. **Live Placement & Feedback:** Live spacing verification, distance warnings (> 10 ft / 3m warning, < 3 ft duplicate/too close, unplaced scan detection, island warnings).
5. **Processing:** Generation of previews, multiresolution cube tiles (levels 512, 1024, 2048, 4096), metadata extraction, and job tracking.
6. **Tour Editor (7 Tabs):**
   - **Scans:** Group by room/level, reorder, designate start scan, hide from walkthrough, adjust start view (yaw, pitch, FOV).
   - **Links:** Place navigation hotspots between scans with return links, custom styling, arrival view override, and look-at orientation.
   - **Content (POIs):** Place interactive product cards with Indian market fit (₹ INR prices, WhatsApp direct enquiry CTA pre-filling property, room, and item), info cards, links, contact triggers.
   - **Plan:** Floor plan visualization, scan pins, and view cones.
   - **3D View:** Dollhouse view interface and level navigation.
   - **Settings:** Tour branding, viewer controls toggles, WhatsApp floating button, custom domains.
   - **Extras / Publish:** Friendly custom slug, QR code with logo, iframe embed code, password protection, and social share previews.
7. **Lead Capture:** Integrated Leads Inbox with CRM statuses (New, Contacted, Qualified, Closed) and direct WhatsApp response.

---

## 2. Architecture & Technology Stack (Strict No-Supabase Constraint)

As specified in the architectural mandate, all Supabase dependencies are completely omitted. Standard, portable, enterprise-grade open-source infrastructure is utilized:

### 2.1 Core Infrastructure
- **Database:** PostgreSQL (direct connection via connection pooling; runs locally via Docker Compose; portable to Railway, Neon, AWS RDS, self-hosted).
- **ORM & Migrations:** Prisma ORM with strongly-typed TypeScript models, relational integrity, foreign key cascades, and automated schema migrations.
- **Authentication:** Standard secure session / JWT authentication (Auth.js compatible architecture), Argon2/bcrypt password hashing, multi-tenant session tokens, strict role-based route middleware.
- **Object Storage Service:** Modular `StorageService` abstraction interface:
  - `CloudflareR2StorageAdapter`: Production storage with S3 API compatibility and zero-egress fees for panoramic tiles and media.
  - `LocalStorageAdapter`: Local filesystem storage adapter for local testing and offline execution.
- **Job Processing System:** PostgreSQL-backed queue (`pg-boss` or transactional `SKIP LOCKED` architecture) providing reliable job retries (with exponential backoff 1 min, 5 min, 15 min), progress tracking (0–100%), and dead-letter queue isolation.
- **Image Worker Service:** Dedicated Node.js + Sharp / libvips worker in Docker for image resizing, 2048×1024 preview generation, 400×200 thumbnails, and multiresolution cubemap tiling (`libvips dzsave`).
- **Spatial Engine Abstraction:** Decoupled Python GPU worker (COLMAP, LightGlue + ALIKED, Open3D, Depth Anything V2-Small) communicating via message queues. The web server and client applications interact only with the job queue, never running heavy 3D compute directly.

---

## 3. Multi-Tenant Tenancy Hierarchy & Security Matrix

### 3.1 Tenancy Hierarchy
```
Platform (Super Admin: Raj)
  └── Partner (White-Label Agency / Reseller; Default: "RenderWalk")
        └── Organization (Customer Studio / Company)
              ├── Members (Owner, Editor, Viewer)
              ├── Tours
              │     ├── Rooms & Levels
              │     ├── Scans (Panoramas, Tiles, Previews)
              │     ├── Links (Hotspots, Return Links)
              │     ├── Content Items (Product Cards, Info, WhatsApp CTAs)
              │     └── Floor Plans & Spatial Models
              ├── Brand Kits & Custom Domains
              ├── Leads Inbox
              └── Processing Jobs & Audit Logs
```

### 3.2 Authorization Matrix
| Role | Level | Capabilities |
| :--- | :--- | :--- |
| **Super Admin** | Platform | Global platform settings, manage all partners, plan catalog, billing, system audit logs |
| **Partner Admin** | Partner | Manage partner's organizations, custom white-label branding, custom domain, partner plans |
| **Organization Owner**| Organization | Full tour CRUD, billing/plan management, team invitations, brand kits, leads inbox, API keys |
| **Editor** | Organization | Create and edit tours, upload scans, place links/POIs, publish, view leads |
| **Viewer** | Organization | Read-only access to drafts, preview tours, leave review feedback |
| **Visitor** | Public | View published tours via link/QR/embed; submit enquiries (no login required) |

Every database table containing tenant data enforces `organization_id` indexing and server-side tenant scoping.

---

## 4. Database Schema Specification (Prisma / PostgreSQL)

Core models defined for PostgreSQL:
1. `User`, `Account`, `Session`, `VerificationToken`
2. `Partner`, `PartnerMember`
3. `Organization`, `OrganizationMember`, `Invitation`
4. `Tour`, `TourVersion`, `CaptureSession`
5. `Room`, `Level`, `Scan`, `ScanVersion`, `ScanFile`
6. `Link`, `ContentItem`, `Product`
7. `FloorPlan`, `FloorPlanPin`, `SpatialModel`
8. `BrandKit`, `CustomDomain`, `Lead`
9. `ProcessingJob`, `JobEvent`, `AuditLog`, `ApiKey`

---

## 5. RenderWalk Design System Tokens

- **Canvas Background:** `#0E0C0A` (Deepest charcoal black)
- **App Background:** `#141210` (Dark warm espresso)
- **Viewer Background:** `#1A1714` (Neutral dark architectural)
- **Surface / Cards:** `#1B1815` (Warm elevated surface)
- **Primary Text:** `#F6F2EC` (Warm architectural cream)
- **Secondary Text:** `#F6F2EC` at 74% opacity
- **Accent (Brass):** `#D6A77A` (Golden brass accent)
- **Success:** `#9CC0B4` (Sage green)
- **Warning:** `#F0A060` (Warm amber)
- **Danger:** `#E07A6A` (Muted terracotta red)
- **Glass Panel:** `rgba(22, 20, 18, 0.66)` with 18px backdrop blur and 1px border `rgba(255, 255, 255, 0.12)`
- **Corner Radii:** Buttons 10px, Panels 16px, Cards 20px, Chips fully rounded.

---

## 6. Phase 0 & Phase 1 Roadmap Milestones

- **Phase 0 (Foundation):**
  - Tenant isolation and permission enforcement.
  - Multi-tenant data structures with PostgreSQL/Prisma.
  - StorageService abstraction with S3/R2 and local adapters.
  - Job queue architecture with retry and status reporting.
  - Clean architectural UI system with exact RenderWalk design tokens.
  
- **Phase 1 (Web Core & Mobile Capture App):**
  - Interactive 360° panorama viewer with navigation links.
  - Batch upload with client-side 2:1 validation and spacing rules engine.
  - Live placement feedback: distance warnings (> 10 ft / 3m), island detection.
  - 7-tab Tour Editor (Scans, Links, Content, Plan, 3D, Settings, Publish).
  - Indian market features: ₹ INR pricing, WhatsApp enquiry direct link.
  - Leads Inbox with status pipeline (New, Contacted, Qualified, Closed).
  - Share modal: QR code generation, iframe embed code, password gating.

---

## 7. Phase 1 Step B/C Implementation Progress

- **Multi-resolution Tiling Pipeline:**
  - Implemented dynamic level calculation based on source resolution (`calculateResolutionLevels`). E.g., 8192×4096 yields 5 levels (Level 0: 512×256 up to Level 4: 8192×4096 with 512px tiles).
  - Storage path convention enforced: `organizations/{organizationId}/tours/{tourId}/scans/{scanId}/panoramas/tiles/level-{level}/{x}-{y}.jpg`.
  - JSON Tile Manifest generation with dimensions, tileSize, and preview/thumb URLs.
  - `services/image-worker` created with Dockerfile, Sharp/libvips tiling pipeline.

- **Progressive Viewer Loading & Quality:**
  - Low-res blurred preview first with subtle loading indicator.
  - Dynamic resolution status chip (e.g. "Level 3: 4K HD", "Level 4: 8K Crisp").
  - Smooth pan-to-look, pinch zoom, compass heading, and FOV readout (40°–110°).
  - Zero-egress Cloudflare R2 delivery architecture.

- **Custom Floor Plan & CAD Architecture:**
  - `FloorPlanImportService` with raster (`ImageFloorPlanAdapter`), sanitized SVG (`SvgFloorPlanAdapter`), and truthful DXF fallback (`DxfFloorPlanAdapter`).
  - Interactive floor plan viewer with scan pin placement and dynamic view direction cone (pointing in `panYaw` orientation).
  - Multi-level floor plan support (Ground Floor, Level 1, Terrace).

- **Render Package & Tour Import:**
  - Controlled import pipeline (`TourImportService`) accepting SketchUp / V-Ray render packages (Appendix C format).
  - SHA-256 duplicate dataset detection preventing duplicate ingestion.
  - Multi-stage `PANORAMA_PROCESS` job tracking (0–10% Validation, 10–25% Metadata/preview, 25–80% Tiles, 80–90% Storage, 90–100% Manifest).

---

## 8. Phase 1 Step D Implementation: Publishing, Plans & Feature Gating

### 8.1 Verification of Prior Deliverables
- **1. Multi-resolution panorama processing:** Class B (Calculation, storage paths, manifest spec, and image-worker service in TypeScript + Dockerfile; simulated pipeline stages in Android).
- **2. Tile manifest generation:** Class A (Fully implemented and wired across Prisma schema, backend service, repository, and UI viewer).
- **3. Progressive 360 viewer:** Class A (Fully implemented and wired in Compose UI with low-res preview, dynamic resolution status, and pan/zoom/compass).
- **4. Floor-plan pins:** Class A (Fully implemented with pins, headings, and CAD/SVG adapters).
- **5. Render-package import:** Class B (Schema, parser, validation, duplicate SHA-256 detection, and repository methods exist).
- **6. Job lifecycle and retry:** Class A (Full PostgreSQL queue model, retry logic, attempt incrementation, and UI monitor).
- **7. Multi-tenant organization isolation:** Class A (Multi-tenant scoping on all tables, cross-tenant security guard, verified by tests).
- **8. Tour creation and publishing flow:** Class A (Draft/Published/Unpublished lifecycle, pre-flight validation, and public viewer).
- **9. R2/local storage abstraction:** Class D (Production TypeScript storage adapter exists in `packages/storage`, used by image-worker).

### 8.2 Production Publishing Flow & Security (Part 1 & 2)
- Implemented unauthenticated public visitor projection (`getPublicTour`) returning `PublicTourView` and `PublicScanView` without exposing private internal identifiers, database keys, or unstitched source file paths.
- Supported safe unpredictable tokens (`publicToken`) alongside clean human slugs.
- Immediate revocation on unpublish: `unpublishTour(tourId)` instantly blocks public access.
- Pre-flight publishing validation (`validateForPublishing`) requiring at least one scan, designated non-hidden start scan, valid viewer FOV, complete multi-resolution tile manifests, and absence of failed or processing scans.

### 8.3 Centralized Plan System & Authoritative Feature Gating (Part 3, 4 & 5)
- Centralized `PlanCapability` enum across Kotlin and TypeScript: `TOUR_LIMIT`, `STORAGE_LIMIT`, `ADVANCED_HOTSPOTS`, `FLOOR_PLAN`, `DOLLHOUSE`, `CUSTOM_BRANDING`, `PASSWORD_PROTECTION`, `CUSTOM_DOMAIN`, `VIDEO_EXPORT`, `PRESENTATION_MODE`, `ANALYTICS`, `LEAD_CAPTURE`, `API_ACCESS`.
- Standard plans: `Starter` (5 tours, 20 GB, 40 scans/tour), `Studio` (25 tours, 100 GB, 100 scans/tour), `Partner` (100 tours, 500 GB, 250 scans/tour, white-label, custom domain).
- Server-side authoritative enforcement with standard error codes: `PLAN_LIMIT_REACHED`, `STORAGE_QUOTA_EXCEEDED`, `FEATURE_NOT_AVAILABLE`.
- Tour scan cap enforcement: `assertCanAddScanToTour` stops adding scans beyond the plan's `maxScansPerTour`.

### 8.4 Reliable Storage Usage Accounting (Part 6)
- Organization-level 6-bucket storage breakdown:
  1. Original uploads (24 MB avg)
  2. Panorama tiles (28 MB avg)
  3. Preview assets (2 MB avg)
  4. Thumbnails (200 KB avg)
  5. Floor plans (4 MB avg)
  6. Render packages (18 MB avg)
- Storage reconciliation method (`reconcileStorage`) synchronizing physical asset storage with organization storage records to eliminate drift.

### 8.5 Verification & Test Coverage (Part 7)
- 31 unit tests passing, covering pre-flight validation, cross-tenant security violation rejection, feature entitlement enforcement, quota limits, scan count limits, storage breakdown, and public visitor access.


