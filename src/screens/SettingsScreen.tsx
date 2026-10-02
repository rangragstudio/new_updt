import React, { useState } from 'react';
import {
  Settings,
  CreditCard,
  Globe,
  MessageCircle,
  Bell,
  CheckCircle,
  Database,
  Check,
  AlertCircle
} from 'lucide-react';
import { useRepository } from '../hooks/useRepository';
import { PlanCapability } from '../types/models';
import { ArchitecturalCard, BrassButton } from '../components/UIPrimitives';

export const SettingsScreen: React.FC = () => {
  const { currentOrg, currentPlan, tours, notifications, customDomains, repository } =
    useRepository();

  const orgTours = tours.filter((t) => t.orgId === currentOrg.id);
  const accounting = repository.getStorageAccounting();
  const domainConfig = customDomains.find((d) => d.orgId === currentOrg.id);

  const [studioName, setStudioName] = useState(currentOrg.name);
  const [whatsappNum, setWhatsappNum] = useState(currentOrg.whatsappNumber);
  const [customDomainInput, setCustomDomainInput] = useState(
    domainConfig?.hostname || 'tours.rangragstudio.com'
  );
  const [domainVerified, setDomainVerified] = useState(domainConfig?.status === 'verified');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveStudio = (e: React.FormEvent) => {
    e.preventDefault();
    repository.updateOrganization({
      name: studioName,
      whatsappNumber: whatsappNum
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleVerifyDomain = () => {
    try {
      repository.registerCustomDomain(customDomainInput);
      const verified = repository.verifyCustomDomain(customDomainInput);
      setDomainVerified(verified);
    } catch (err) {
      alert((err as any).message);
    }
  };

  const capabilitiesList = [
    { cap: PlanCapability.FLOOR_PLAN, label: '2D Floor Plans' },
    { cap: PlanCapability.DOLLHOUSE, label: '3D Dollhouse' },
    { cap: PlanCapability.CUSTOM_BRANDING, label: 'White-Label Branding' },
    { cap: PlanCapability.PASSWORD_PROTECTION, label: 'Password Gate' },
    { cap: PlanCapability.CUSTOM_DOMAIN, label: 'Custom Domain Routing' },
    { cap: PlanCapability.LEAD_CAPTURE, label: 'Direct CRM Leads' },
    { cap: PlanCapability.ANALYTICS, label: 'Spatial Analytics' }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      <div>
        <div className="text-xs uppercase font-bold tracking-widest text-[#D6A77A] mb-1">
          WORKSPACE PREFERENCES
        </div>
        <h1 className="text-2xl font-bold font-serif-heading text-[#F6F2EC]">
          Studio & Plan Settings
        </h1>
      </div>

      {/* 1. Subscription & Entitlements Card */}
      <ArchitecturalCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#D6A77A]">
              CURRENT SUBSCRIPTION
            </div>
            <h3 className="text-lg font-bold font-serif-heading text-[#F6F2EC]">
              {currentPlan.name} Plan
            </h3>
            <div className="text-xs text-[#F6F2EC]/60">
              ₹{currentPlan.monthlyPriceInr.toLocaleString('en-IN')}/month • Billed Annually
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#9CC0B4]/20 border border-[#9CC0B4]/40 text-xs font-bold text-[#9CC0B4]">
            ACTIVE
          </span>
        </div>

        {/* Quotas */}
        <div className="space-y-3 mb-5">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#F6F2EC]/70">Active Tours Quota</span>
              <span className="font-bold text-[#F6F2EC]">
                {orgTours.length} / {currentPlan.maxActiveTours} tours
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#141210] overflow-hidden">
              <div
                className="h-full bg-[#D6A77A] rounded-full"
                style={{ width: `${(orgTours.length / currentPlan.maxActiveTours) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#F6F2EC]/70">Storage Accounting</span>
              <span className="font-bold text-[#F6F2EC]">
                {currentOrg.storageUsedGb.toFixed(1)} GB / {currentPlan.storageLimitGb} GB
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#141210] overflow-hidden">
              <div
                className="h-full bg-[#D6A77A] rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    (currentOrg.storageUsedGb / currentPlan.storageLimitGb) * 100
                  )}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* 6-Bucket Storage Breakdown */}
        <div className="p-3 rounded-xl bg-[#141210] border border-white/5 mb-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#D6A77A] mb-2">
            Storage Usage Breakdown (6 Buckets)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-[#F6F2EC]/70">
            <div>Original Uploads: {(accounting.originalUploadsBytes / 1024 / 1024).toFixed(0)} MB</div>
            <div>Panorama 8K Tiles: {(accounting.panoramaTilesBytes / 1024 / 1024).toFixed(0)} MB</div>
            <div>Preview Assets: {(accounting.previewAssetsBytes / 1024 / 1024).toFixed(0)} MB</div>
            <div>Thumbnails: {(accounting.thumbnailsBytes / 1024).toFixed(0)} KB</div>
            <div>Floor Plans: {(accounting.floorPlansBytes / 1024 / 1024).toFixed(0)} MB</div>
            <div>Render Packages: {(accounting.renderPackagesBytes / 1024 / 1024).toFixed(0)} MB</div>
          </div>
        </div>

        {/* Entitlements Badges */}
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#F6F2EC]/50 mb-2">
            Entitled Feature Capabilities
          </div>
          <div className="flex flex-wrap gap-2">
            {capabilitiesList.map(({ cap, label }) => {
              const isEntitled = currentPlan.capabilities.has(cap);
              return (
                <span
                  key={cap}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                    isEntitled
                      ? 'bg-[#D6A77A]/15 text-[#D6A77A] border-[#D6A77A]/30'
                      : 'bg-white/5 text-[#F6F2EC]/30 border-white/10'
                  }`}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </ArchitecturalCard>

      {/* 2. Custom Domain Configuration */}
      <ArchitecturalCard>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#D6A77A]">
            CUSTOM DOMAIN ROUTING
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              domainVerified
                ? 'bg-[#9CC0B4]/20 text-[#9CC0B4] border border-[#9CC0B4]/30'
                : 'bg-[#F0A060]/20 text-[#F0A060]'
            }`}
          >
            {domainVerified ? 'VERIFIED & SSL ACTIVE' : 'PENDING VERIFICATION'}
          </span>
        </div>
        <p className="text-xs text-[#F6F2EC]/60 mb-3">
          White-label your walkthroughs with your studio's custom subdomain.
        </p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={customDomainInput}
              onChange={(e) => setCustomDomainInput(e.target.value)}
              placeholder="tours.yourstudio.com"
              className="flex-1 h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
            />
            <BrassButton text="Verify DNS" onClick={handleVerifyDomain} icon={Check} />
          </div>

          <div className="p-3 rounded-xl bg-[#141210] border border-white/5 text-xs">
            <div className="text-[#F6F2EC]/50 text-[10px] font-bold uppercase tracking-wider mb-1">
              Required DNS CNAME Record
            </div>
            <div className="font-mono text-[11px] text-[#D6A77A]">
              CNAME &rarr; cname.renderwalk.com
            </div>
          </div>
        </div>
      </ArchitecturalCard>

      {/* 3. Studio Identity */}
      <ArchitecturalCard>
        <div className="text-[10px] uppercase font-bold tracking-wider text-[#D6A77A] mb-3">
          STUDIO IDENTITY & ENQUIRIES
        </div>
        <form onSubmit={handleSaveStudio} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
              Studio Name
            </label>
            <input
              type="text"
              required
              value={studioName}
              onChange={(e) => setStudioName(e.target.value)}
              className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
              WhatsApp Enquiry Number
            </label>
            <input
              type="tel"
              required
              value={whatsappNum}
              onChange={(e) => setWhatsappNum(e.target.value)}
              className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {savedSuccess ? (
              <span className="text-xs text-[#9CC0B4] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Changes saved!</span>
              </span>
            ) : <span />}
            <BrassButton type="submit" text="Save Studio Profile" />
          </div>
        </form>
      </ArchitecturalCard>

      {/* 4. Notifications Log */}
      <ArchitecturalCard>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#D6A77A]">
            NOTIFICATION DISPATCH LOG
          </div>
          <span className="text-xs text-[#F6F2EC]/50 font-mono">
            {notifications.length} Alerts
          </span>
        </div>

        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-3 rounded-xl bg-[#141210] border border-white/5 flex items-start justify-between text-xs"
            >
              <div>
                <div className="font-bold text-[#F6F2EC]">{n.title}</div>
                <div className="text-[#F6F2EC]/70">{n.message}</div>
              </div>
              <span className="text-[10px] text-[#F6F2EC]/40 shrink-0 ml-2">{n.createdAt}</span>
            </div>
          ))}
        </div>
      </ArchitecturalCard>
    </div>
  );
};
