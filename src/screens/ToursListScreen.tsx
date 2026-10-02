import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Globe,
  Copy,
  Trash2,
  Building,
  DoorOpen,
  Eye,
  Camera
} from 'lucide-react';
import { useRepository } from '../hooks/useRepository';
import { Tour, TourStatus } from '../types/models';
import { ArchitecturalCard, BrassButton, EmptyStateView } from '../components/UIPrimitives';
import { StatusBadge } from '../components/StatusBadge';

interface ToursListScreenProps {
  onOpenTour: (tourId: string) => void;
  onCreateTour: () => void;
  onPublishTour: (tourId: string) => void;
}

export const ToursListScreen: React.FC<ToursListScreenProps> = ({
  onOpenTour,
  onCreateTour,
  onPublishTour
}) => {
  const { currentOrg, tours, repository } = useRepository();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<TourStatus>('ALL');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const orgTours = useMemo(() => {
    return tours.filter((t) => t.orgId === currentOrg.id);
  }, [tours, currentOrg.id]);

  const filteredTours = useMemo(() => {
    return orgTours.filter((tour) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tour.name.toLowerCase().includes(q) ||
        tour.propertyType.toLowerCase().includes(q) ||
        tour.address.toLowerCase().includes(q);

      const matchesFilter =
        selectedFilter === 'ALL' || tour.status === selectedFilter;

      return matchesSearch && matchesFilter;
    });
  }, [orgTours, searchQuery, selectedFilter]);

  const filterTabs: { status: TourStatus; label: string; count: number }[] = [
    { status: 'ALL', label: 'All', count: orgTours.length },
    {
      status: 'PUBLISHED',
      label: 'Published',
      count: orgTours.filter((t) => t.status === 'PUBLISHED').length
    },
    {
      status: 'DRAFT',
      label: 'Drafts',
      count: orgTours.filter((t) => t.status === 'DRAFT').length
    },
    {
      status: 'PROCESSING',
      label: 'Processing',
      count: orgTours.filter((t) => t.status === 'PROCESSING').length
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-bold tracking-widest text-[#D6A77A] mb-1">
            SPACES & TOURS
          </div>
          <h1 className="text-2xl font-bold font-serif-heading text-[#F6F2EC]">
            Virtual Walkthroughs
          </h1>
        </div>
        <BrassButton text="New Tour" onClick={onCreateTour} icon={Plus} />
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#F6F2EC]/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by tour name, property type, or address..."
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#1B1815] border border-white/10 text-xs sm:text-sm text-[#F6F2EC] placeholder:text-[#F6F2EC]/40 focus:outline-none focus:border-[#D6A77A]"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filterTabs.map((tab) => {
          const isSelected = selectedFilter === tab.status;
          return (
            <button
              key={tab.status}
              type="button"
              onClick={() => setSelectedFilter(tab.status)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#D6A77A] text-[#0E0C0A]'
                  : 'bg-[#1B1815] text-[#F6F2EC]/70 hover:text-[#F6F2EC] border border-white/10'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          );
        })}
      </div>

      {/* Tours List */}
      {filteredTours.length === 0 ? (
        <EmptyStateView
          title="No Virtual Tours Found"
          description={
            searchQuery
              ? `No tours match "${searchQuery}". Try a different keyword.`
              : 'You have not created any tours in this category yet.'
          }
          actionText="Create New Tour"
          onActionClick={onCreateTour}
          icon={Building}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTours.map((tour) => (
            <ArchitecturalCard key={tour.id} className="relative group">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div
                  onClick={() => onOpenTour(tour.id)}
                  className="cursor-pointer flex-1 group-hover:text-[#D6A77A] transition-colors"
                >
                  <h3 className="font-bold text-base font-serif-heading text-[#F6F2EC]">
                    {tour.name}
                  </h3>
                  <div className="text-xs text-[#F6F2EC]/60 line-clamp-1">
                    {tour.propertyType} • {tour.address}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={tour.status} />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(activeMenuId === tour.id ? null : tour.id)}
                      className="p-1 text-[#F6F2EC]/60 hover:text-[#F6F2EC] rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {activeMenuId === tour.id && (
                      <div className="absolute right-0 top-7 z-20 w-44 rounded-xl bg-[#141210] border border-white/15 p-1.5 shadow-2xl space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onOpenTour(tour.id);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#F6F2EC] hover:bg-white/10 rounded-lg flex items-center gap-2 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 text-[#D6A77A]" />
                          <span>Open Editor</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onPublishTour(tour.id);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#F6F2EC] hover:bg-white/10 rounded-lg flex items-center gap-2 cursor-pointer"
                        >
                          <Globe className="w-3.5 h-3.5 text-[#9CC0B4]" />
                          <span>Publish & Share</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            repository.duplicateTour(tour.id);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#F6F2EC] hover:bg-white/10 rounded-lg flex items-center gap-2 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#F6F2EC]/70" />
                          <span>Duplicate Tour</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            repository.deleteTour(tour.id);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#E07A6A] hover:bg-red-500/10 rounded-lg flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Tour</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tour Stats Row */}
              <div
                onClick={() => onOpenTour(tour.id)}
                className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-[#F6F2EC]/60 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <DoorOpen className="w-3.5 h-3.5 text-[#F6F2EC]/40" />
                    <span>{tour.roomCount} Rooms</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-[#F6F2EC]/40" />
                    <span>{tour.scanCount} Scans</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-[#F6F2EC]/40" />
                    <span>{tour.viewCount}</span>
                  </span>
                </div>
                <span className="text-[10px] text-[#F6F2EC]/40">Edited {tour.updatedAt}</span>
              </div>
            </ArchitecturalCard>
          ))}
        </div>
      )}
    </div>
  );
};
