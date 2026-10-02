import React from 'react';
import { Box, Layers } from 'lucide-react';
import { Tour, Scan } from '../types/models';

interface DollhouseViewerProps {
  tour: Tour;
  scans: Scan[];
  activeScanId: string;
  onSelectScan: (scanId: string) => void;
  className?: string;
}

export const DollhouseViewer: React.FC<DollhouseViewerProps> = ({
  tour,
  scans,
  activeScanId,
  onSelectScan,
  className = ''
}) => {
  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-center bg-[#0C0A09] select-none p-6 ${className}`}
    >
      {/* 3D Wireframe room volumes canvas */}
      <div className="relative w-80 h-56 border-2 border-[#D6A77A]/40 rounded-xl bg-[#1B1815]/40 flex items-center justify-center shadow-2xl backdrop-blur-sm">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1 p-2">
          {scans.slice(0, 4).map((scan, i) => {
            const isSelected = scan.id === activeScanId;
            return (
              <div
                key={scan.id}
                onClick={() => onSelectScan(scan.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#D6A77A]/30 border-[#D6A77A] text-[#F6F2EC]'
                    : 'bg-[#141210]/60 border-white/10 hover:border-[#D6A77A]/40 text-[#F6F2EC]/70'
                }`}
              >
                <div className="text-[11px] font-bold text-center line-clamp-1">
                  {scan.roomName}
                </div>
                <div className="text-[9px] text-[#D6A77A]">Spot #{i + 1}</div>
              </div>
            );
          })}
        </div>

        {/* Isometric axes indicator */}
        <div className="absolute -bottom-3 -left-3 px-2 py-1 bg-[#141210] border border-white/15 rounded text-[10px] text-[#D6A77A] font-mono">
          3D SPATIAL MODEL
        </div>
      </div>

      <div className="mt-6 text-center">
        <div className="text-[11px] font-bold uppercase tracking-widest text-[#D6A77A] mb-1">
          3D Dollhouse Overview
        </div>
        <p className="text-xs text-[#F6F2EC]/60 mb-4">
          Click any room volume above to fly into the 360° panoramic view
        </p>

        {/* Room Buttons List */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-md">
          {scans.map((scan) => {
            const isSelected = scan.id === activeScanId;
            return (
              <button
                key={scan.id}
                type="button"
                onClick={() => onSelectScan(scan.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#D6A77A] text-[#0E0C0A]'
                    : 'bg-[#1B1815] text-[#F6F2EC]/80 border border-white/10 hover:border-[#D6A77A]/50'
                }`}
              >
                {scan.roomName}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
