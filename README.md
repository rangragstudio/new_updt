# RenderWalk — 360° Virtual Tour & Architectural Walkthrough SaaS

RenderWalk is a next-generation 360° virtual tour and spatial walkthrough SaaS platform built for architects, interior designers, ArchViz studios, builders, and photographers.

## Features Ported & Implemented

- **Interactive 360° Panorama Viewer Canvas**:
  - Smooth mouse/touch drag pan (yaw & pitch) and wheel/pinch zoom (FOV 40°–110°)
  - Dynamic architectural room simulation (ambient gradients, perspective mullions, warm lighting casts, floor horizon tilt)
  - Progressive tile loading status (Levels 2K, 4K HD, 8K Crisp)
  - Heading compass and viewpoint crosshairs
  - Interactive navigation hotspots (floor rings with walking icons) for fluid room-to-room transitions
  - Interactive product hotspots (brass price badges) opening product detail cards with instant WhatsApp enquiry link pre-filling room, product, and tour details
- **7-Tab Tour Editor**:
  - **Scans**: Group rooms, start scan designation, hide/unhide toggle, add room scan, process 8K multiresolution tiles, import render package
  - **Links**: Manage bidirectional navigation hotspots between scans
  - **Content**: Product and material showcase cards with ₹ INR pricing, dimensions, and WhatsApp CTA
  - **2D Floor Plan**: Schematic CAD layout with interactive pins and dynamic view direction cones pointing in yaw orientation, level switching, and CAD/SVG upload with security sanitization
  - **3D Dollhouse**: 3D spatial perspective overview with room volumes and fly-in selection
  - **Settings**: Custom branding palette and accent color
- **Matterport-Style Live Capture Simulator**:
  - Drafting grid canvas with scan positions, trajectory path, and gold 7–10 ft next shot guidance ring
  - Live placement feedback & spacing rules engine (>10 ft warning, <3 ft warning)
  - Finish session checklist
- **Leads Inbox & CRM**:
  - Integrated client enquiry inbox with status filters (New, Contacted, Qualified, Closed)
  - One-click direct "Reply on WhatsApp" button with pre-filled greeting and tour title
- **Super Admin Portal & Multi-Tenancy**:
  - Instant tenant organization switching to test strict multi-tenant data isolation
  - System architecture status (PostgreSQL, Cloudflare R2, strict zero-Supabase verification)
  - Background processing queue with retry capabilities
  - Immutable activity audit log
- **Studio & Plan Settings**:
  - Subscription tier quotas (Starter, Studio, Partner) and authoritative feature gating
  - Reliable 6-bucket storage accounting
  - Custom domain routing with DNS CNAME verification
- **Publish & Share Flow**:
  - Pre-flight publishing validation check
  - Permanent public slug and secure public token
  - Visual QR code and WhatsApp share
  - Responsive HTML iframe embed code generator with one-click copy
  - Password protection gate toggle
  - Unauthenticated public visitor walkthrough mode

## Tech Stack

- **Framework**: React 19, TypeScript
- **Bundler & Dev Server**: Vite
- **Styling**: Tailwind CSS v4, Warm Dark Architectural Design System (`#0E0C0A`, `#141210`, `#1B1815`, `#D6A77A`, `#9CC0B4`, `#F0A060`, `#E07A6A`)
- **Icons**: Lucide React
