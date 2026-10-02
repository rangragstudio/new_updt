import React from 'react';
import {
  Cloud,
  Plus,
  Camera,
  Layers,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles
} from 'lucide-react';
import { useRepository } from '../hooks/useRepository';
import { StatCard, ArchitecturalCard, BrassButton, OutlinedBrassButton } from '../components/UIPrimitives';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardScreenProps {
  onOpenTour: (tourId: string) => void;
  onCreateTour: () => void;
  onOpenCapture: () => void;
  onOpenLeads: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onOpenTour,
  onCreateTour,
  onOpenCapture,
  onOpenLeads
}) => {
  const { currentOrg, tours, leads, jobs } = useRepository();

  const orgTours = tours.filter((t) => t.orgId === currentOrg.id);
  const orgLeads = leads.filter((l) => l.orgId === currentOrg.id);

  const publishedCount = orgTours.filter((t) => t.status === 'PUBLISHED').length;
  const totalViews = orgTours.reduce((sum, t) => sum + t.viewCount, 0);
  const totalLeads = orgLeads.length;

  const storageProgress = Math.min(100, (currentOrg.storageUsedGb / currentOrg.storageLimitGb) * 100);

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      {/* 1. Header Greeting & Status Banner */}
      <div>
        <div className="text-xs uppercase font-bold tracking-widest text-[#D6A77A] mb-1">
          {currentOrg.name}
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold font-serif-heading text-[#F6F2EC] mb-1.5">
          Architectural Studio Overview
        </h1>
        <p className="text-xs text-[#F6F2EC]/70">
          {jobs.filter((j) => j.status === 'RUNNING').length} tours currently active in processing queue •{' '}
          {totalLeads} client enquiries in Leads CRM.
        </p>
      </div>

      {/* 2. Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Live Tours"
          value={publishedCount.toString()}
          subtext={`of ${currentOrg.maxToursLimit} allocated`}
        />
        <StatCard
          title="Tour Views"
          value={totalViews.toString()}
          subtext="+18% this month"
        />
        <StatCard
          title="Leads / Enquiries"
          value={totalLeads.toString()}
          subtext="Direct WhatsApp & CRM"
          badge="CRM"
          className="cursor-pointer hover:border-[#D6A77A]/50"
        />
        <StatCard
          title="Storage Used"
          value={`${currentOrg.storageUsedGb.toFixed(1)} GB`}
          subtext={`of ${currentOrg.storageLimitGb} GB limit`}
        />
      </div>

      {/* 3. Storage & Plan Usage Bar */}
      <ArchitecturalCard>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#F6F2EC]">
              {currentOrg.planName} Quotas
            </span>
            <span className="text-[10px] text-[#9CC0B4] bg-[#9CC0B4]/15 px-2 py-0.5 rounded-full border border-[#9CC0B4]/30 font-semibold">
              R2 CDN Active
            </span>
          </div>
          <span className="text-xs text-[#D6A77A] font-semibold">
            {storageProgress.toFixed(1)}% Storage Consumed
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-[#141210] overflow-hidden mb-2">
          <div
            className="h-full bg-[#D6A77A] transition-all duration-500 rounded-full"
            style={{ width: `${storageProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-[#F6F2EC]/60">
          <span>
            Storage: {currentOrg.storageUsedGb.toFixed(1)} GB / {currentOrg.storageLimitGb} GB
          </span>
          <span>
            Active Tours: {orgTours.length} / {currentOrg.maxToursLimit}
          </span>
        </div>
      </ArchitecturalCard>

      {/* 4. Active Background Processing Queue */}
      <ArchitecturalCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#D6A77A] animate-ping" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#D6A77A]">
              BACKGROUND PROCESSING QUEUE
            </span>
          </div>
          <span className="text-xs text-[#F6F2EC]/50 font-mono">
            {jobs.length} Active Tasks
          </span>
        </div>

        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="p-3 rounded-xl bg-[#141210] border border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#F6F2EC]">{job.tourName}</span>
                <span className="text-xs font-semibold text-[#D6A77A]">
                  {job.status === 'DONE' ? '100%' : `${job.progress}%`}
                </span>
              </div>
              <div className="text-[11px] text-[#F6F2EC]/60 mb-2">{job.step}</div>
              <div className="w-full h-1.5 rounded-full bg-[#1B1815] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    job.status === 'DONE' ? 'bg-[#9CC0B4]' : 'bg-[#D6A77A]'
                  }`}
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </ArchitecturalCard>

      {/* 5. Recent Tours */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#F6F2EC]/50">
            RECENT TOURS
          </span>
          <button
            type="button"
            onClick={() => onOpenTour(orgTours[0]?.id || '')}
            className="text-xs font-bold text-[#D6A77A] hover:underline cursor-pointer"
          >
            View All ({orgTours.length})
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgTours.slice(0, 3).map((tour) => (
            <ArchitecturalCard
              key={tour.id}
              onClick={() => onOpenTour(tour.id)}
              className="group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-sm text-[#F6F2EC] font-serif-heading group-hover:text-[#D6A77A] transition-colors">
                    {tour.name}
                  </h3>
                  <StatusBadge status={tour.status} />
                </div>
                <p className="text-xs text-[#F6F2EC]/60 mb-4 line-clamp-1">
                  {tour.propertyType} • {tour.address}
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#F6F2EC]/50">
                <div className="flex items-center gap-3">
                  <span>{tour.roomCount} Rooms</span>
                  <span>{tour.scanCount} Scans</span>
                  <span>{tour.viewCount} Views</span>
                </div>
                <span className="text-[10px] text-[#D6A77A] group-hover:translate-x-1 transition-transform">
                  Edit &rarr;
                </span>
              </div>
            </ArchitecturalCard>
          ))}
        </div>
      </div>

      {/* 6. Quick Action CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <BrassButton
          text="Create Virtual Tour"
          onClick={onCreateTour}
          icon={Plus}
          className="flex-1"
        />
        <OutlinedBrassButton
          text="Launch Live Capture"
          onClick={onOpenCapture}
          icon={Camera}
          className="flex-1"
        />
      </div>
    </div>
  );
};
