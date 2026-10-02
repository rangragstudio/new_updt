import React, { useState, useMemo } from 'react';
import {
  Inbox,
  Search,
  MessageCircle,
  ShoppingBag,
  ExternalLink,
  CheckCircle,
  Phone,
  Mail,
  X
} from 'lucide-react';
import { useRepository } from '../hooks/useRepository';
import { Lead, LeadStatus } from '../types/models';
import { ArchitecturalCard, BrassButton, EmptyStateView } from '../components/UIPrimitives';
import { LeadStatusBadge } from '../components/StatusBadge';

export const LeadsInboxScreen: React.FC = () => {
  const { currentOrg, leads, repository } = useRepository();

  const [selectedFilter, setSelectedFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const orgLeads = useMemo(() => {
    return leads.filter((l) => l.orgId === currentOrg.id);
  }, [leads, currentOrg.id]);

  const filteredLeads = useMemo(() => {
    return orgLeads.filter((lead) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        lead.tourName.toLowerCase().includes(q) ||
        (lead.productTitle && lead.productTitle.toLowerCase().includes(q));

      const matchesFilter = selectedFilter === 'ALL' || lead.status === selectedFilter;

      return matchesSearch && matchesFilter;
    });
  }, [orgLeads, searchQuery, selectedFilter]);

  const statuses: { status: LeadStatus | 'ALL'; label: string; count: number }[] = [
    { status: 'ALL', label: 'All', count: orgLeads.length },
    { status: 'NEW', label: 'New', count: orgLeads.filter((l) => l.status === 'NEW').length },
    { status: 'CONTACTED', label: 'Contacted', count: orgLeads.filter((l) => l.status === 'CONTACTED').length },
    { status: 'QUALIFIED', label: 'Qualified', count: orgLeads.filter((l) => l.status === 'QUALIFIED').length },
    { status: 'CLOSED', label: 'Closed', count: orgLeads.filter((l) => l.status === 'CLOSED').length }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-bold tracking-widest text-[#D6A77A] mb-1">
            CLIENT ENQUIRIES & LEADS
          </div>
          <h1 className="text-2xl font-bold font-serif-heading text-[#F6F2EC]">
            Leads Inbox
          </h1>
        </div>
        <div className="px-3 py-1 rounded-full bg-[#9CC0B4]/15 border border-[#9CC0B4]/30 text-xs font-bold text-[#9CC0B4] self-start sm:self-auto">
          {orgLeads.length} Total Client Enquiries
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {statuses.map((tab) => {
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

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <EmptyStateView
          title="No Leads in Inbox"
          description={
            searchQuery
              ? `No enquiries match "${searchQuery}".`
              : 'When visitors explore your tours or submit product enquiries, their contact details land here in real time.'
          }
          icon={Inbox}
        />
      ) : (
        <div className="space-y-3">
          {filteredLeads.map((lead) => {
            const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
            const replyMsg = `Hello ${lead.name}, thank you for enquiring about our tour '${lead.tourName}'. We would be delighted to assist you!`;

            return (
              <ArchitecturalCard
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className="hover:border-[#D6A77A]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h3 className="font-bold text-sm sm:text-base font-serif-heading text-[#F6F2EC]">
                      {lead.name}
                    </h3>
                    <div className="text-xs text-[#F6F2EC]/60">
                      {lead.tourName} • {lead.createdAt}
                    </div>
                  </div>
                  <LeadStatusBadge status={lead.status} />
                </div>

                {lead.productTitle && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#D6A77A]/15 border border-[#D6A77A]/30 text-xs text-[#D6A77A] font-semibold mb-2">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Enquired for: {lead.productTitle}</span>
                  </div>
                )}

                <p className="text-xs text-[#F6F2EC]/80 mb-3 italic">
                  "{lead.message}"
                </p>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <div className="text-xs text-[#F6F2EC]/60 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#D6A77A]" />
                    <span>{lead.phone}</span>
                  </div>

                  {/* Direct WhatsApp Response Button */}
                  <a
                    href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(replyMsg)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 px-3 rounded-lg bg-[#9CC0B4] text-[#0E0C0A] hover:bg-[#b0d2c7] text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Reply on WhatsApp</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </div>
              </ArchitecturalCard>
            );
          })}
        </div>
      )}

      {/* Lead Detail & Status Update Dialog */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC]">
                Lead Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="p-1 text-[#F6F2EC]/60 hover:text-[#F6F2EC] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[#F6F2EC]/50">Customer:</span>{' '}
                <span className="font-bold text-[#F6F2EC]">{selectedLead.name}</span>
              </div>
              <div>
                <span className="text-[#F6F2EC]/50">Phone:</span>{' '}
                <span className="text-[#F6F2EC]">{selectedLead.phone}</span>
              </div>
              {selectedLead.email && (
                <div>
                  <span className="text-[#F6F2EC]/50">Email:</span>{' '}
                  <span className="text-[#F6F2EC]">{selectedLead.email}</span>
                </div>
              )}
              <div>
                <span className="text-[#F6F2EC]/50">Tour:</span>{' '}
                <span className="text-[#D6A77A]">{selectedLead.tourName}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#141210] border border-white/10 text-[#F6F2EC]/85 mt-2">
                "{selectedLead.message}"
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#F6F2EC]/50 mb-2">
                Update CRM Status
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'] as LeadStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      repository.updateLeadStatus(selectedLead.id, st);
                      setSelectedLead({ ...selectedLead, status: st });
                    }}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      selectedLead.status === st
                        ? 'bg-[#D6A77A] text-[#0E0C0A] border-[#D6A77A]'
                        : 'bg-[#141210] text-[#F6F2EC]/70 border-white/10 hover:border-white/25'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="h-9 px-4 rounded-[10px] bg-[#141210] border border-white/15 text-xs font-semibold text-[#F6F2EC] hover:bg-white/5 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
