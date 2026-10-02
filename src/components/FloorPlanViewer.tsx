import React, { useState, useRef, useEffect } from 'react';
import { Map, Layers, Navigation } from 'lucide-react';
import { Scan, FloorPlan } from '../types/models';

interface FloorPlanViewerProps {
  scans: Scan[];
  activeScanId: string;
  panYaw: number;
  floorPlans: FloorPlan[];
  onSelectScan: (scanId: string) => void;
  onPlacePin: (normX: number, normY: number) => void;
  className?: string;
}

export const FloorPlanViewer: React.FC<FloorPlanViewerProps> = ({
  scans,
  activeScanId,
  panYaw,
  floorPlans,
  onSelectScan,
  onPlacePin,
  className = ''
}) => {
  const [selectedLevelIdx, setSelectedLevelIdx] = useState(0);
  const levels = ['Ground Floor', 'Level 1', 'Terrace'];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentPlan = floorPlans[selectedLevelIdx] || floorPlans[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const cx = w / 2;
    const cy = h / 2;

    // Clear
    ctx.fillStyle = '#13110E';
    ctx.fillRect(0, 0, w, h);

    // Architectural drafting grid
    ctx.strokeStyle = 'rgba(214, 167, 122, 0.08)';
    ctx.lineWidth = 1;
    const gridStep = 30;
    for (let x = 0; x < w; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Outer architectural boundary walls
    ctx.beginPath();
    ctx.moveTo(cx - 160, cy - 110);
    ctx.lineTo(cx + 160, cy - 110);
    ctx.lineTo(cx + 160, cy + 130);
    ctx.lineTo(cx - 90, cy + 130);
    ctx.lineTo(cx - 90, cy + 50);
    ctx.lineTo(cx - 160, cy + 50);
    ctx.closePath();

    ctx.fillStyle = '#221F1B';
    ctx.fill();
    ctx.strokeStyle = '#D6A77A';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Interior room partitions
    ctx.strokeStyle = 'rgba(214, 167, 122, 0.4)';
    ctx.lineWidth = 2;

    // Room divider 1
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 110);
    ctx.lineTo(cx - 10, cy + 50);
    ctx.stroke();

    // Room divider 2
    ctx.beginPath();
    ctx.moveTo(cx - 160, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.stroke();

    // Room divider 3
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 10);
    ctx.lineTo(cx + 160, cy + 10);
    ctx.stroke();

    // View Direction Cone for active scan pin
    const activePin = currentPlan?.pins.find((p) => p.scanId === activeScanId);
    if (activePin) {
      const pinX = activePin.x * w;
      const pinY = activePin.y * h;
      const coneAngleRad = ((panYaw - 90) * Math.PI) / 180;
      const spreadRad = (30 * Math.PI) / 180;
      const coneLength = 55;

      ctx.beginPath();
      ctx.moveTo(pinX, pinY);
      ctx.lineTo(
        pinX + Math.cos(coneAngleRad - spreadRad) * coneLength,
        pinY + Math.sin(coneAngleRad - spreadRad) * coneLength
      );
      ctx.lineTo(
        pinX + Math.cos(coneAngleRad + spreadRad) * coneLength,
        pinY + Math.sin(coneAngleRad + spreadRad) * coneLength
      );
      ctx.closePath();

      ctx.fillStyle = 'rgba(214, 167, 122, 0.28)';
      ctx.fill();
      ctx.strokeStyle = '#D6A77A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [selectedLevelIdx, activeScanId, panYaw, currentPlan]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    onPlacePin(nx, ny);
  };

  return (
    <div className={`flex flex-col w-full h-full bg-[#13110E] select-none ${className}`}>
      {/* Top level switcher bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#1B1815] border-b border-white/10">
        <div className="flex items-center gap-2">
          {levels.map((lvl, idx) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSelectedLevelIdx(idx)}
              className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                selectedLevelIdx === idx
                  ? 'bg-[#D6A77A] text-[#0E0C0A]'
                  : 'bg-[#1A1714] text-[#F6F2EC]/60 hover:text-[#F6F2EC] border border-white/10'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-[#D6A77A] flex items-center gap-1">
          <Navigation className="w-3.5 h-3.5" />
          <span>Click canvas to position active pin</span>
        </div>
      </div>

      {/* Main Floor Plan Canvas */}
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        className="relative flex-1 w-full h-full cursor-crosshair overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="w-full h-full object-contain block"
        />

        {/* Scan Pins Overlay */}
        {currentPlan?.pins.map((pin, idx) => {
          const isCurrent = pin.scanId === activeScanId;
          return (
            <div
              key={pin.id}
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectScan(pin.scanId);
              }}
              title={`${pin.scanName} (Click to jump)`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs cursor-pointer shadow-lg transition-transform hover:scale-110 ${
                isCurrent
                  ? 'bg-[#D6A77A] text-[#0E0C0A] ring-4 ring-[#D6A77A]/30 border-2 border-white'
                  : 'bg-[#1B1815] text-[#F6F2EC] border-2 border-[#D6A77A]'
              }`}
            >
              {idx + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
};
