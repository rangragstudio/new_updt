import React from 'react';
import { TourStatus, LeadStatus } from '../types/models';

interface StatusBadgeProps {
  status: TourStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  let bg = 'bg-[#D6A77A]/15 text-[#D6A77A] border-[#D6A77A]/30';
  let label = status as string;

  switch (status) {
    case 'PUBLISHED':
      bg = 'bg-[#9CC0B4]/15 text-[#9CC0B4] border-[#9CC0B4]/35';
      label = 'PUBLISHED';
      break;
    case 'DRAFT':
      bg = 'bg-[#F0A060]/15 text-[#F0A060] border-[#F0A060]/35';
      label = 'DRAFT';
      break;
    case 'UNPUBLISHED':
      bg = 'bg-[#F0A060]/15 text-[#F0A060] border-[#F0A060]/35';
      label = 'UNPUBLISHED';
      break;
    case 'PROCESSING':
      bg = 'bg-[#D6A77A]/15 text-[#D6A77A] border-[#D6A77A]/35';
      label = 'PROCESSING';
      break;
    case 'ARCHIVED':
      bg = 'bg-stone-600/20 text-stone-400 border-stone-500/30';
      label = 'ARCHIVED';
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${bg} ${className}`}
    >
      {label}
    </span>
  );
};

export const LeadStatusBadge: React.FC<{ status: LeadStatus; className?: string }> = ({
  status,
  className = ''
}) => {
  let bg = 'bg-[#9CC0B4]/20 text-[#9CC0B4] border-[#9CC0B4]/30';
  switch (status) {
    case 'NEW':
      bg = 'bg-[#9CC0B4]/20 text-[#9CC0B4] border-[#9CC0B4]/40';
      break;
    case 'CONTACTED':
      bg = 'bg-[#D6A77A]/20 text-[#D6A77A] border-[#D6A77A]/40';
      break;
    case 'QUALIFIED':
      bg = 'bg-sky-400/20 text-sky-400 border-sky-400/40';
      break;
    case 'CLOSED':
      bg = 'bg-stone-500/20 text-stone-400 border-stone-500/30';
      break;
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${bg} ${className}`}
    >
      {status}
    </span>
  );
};
