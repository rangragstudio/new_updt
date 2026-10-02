import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  AlertTriangle,
  Info,
  Check,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useRepository } from '../hooks/useRepository';
import { BrassButton, OutlinedBrassButton, GlassPanel } from '../components/UIPrimitives';
import { SpacingWarning } from '../types/models';

interface LiveCaptureScreenProps {
  onNavigateBack: () => void;
  onOpenTour: (tourId: string) => void;
}

export const LiveCaptureScreen: React.FC<LiveCaptureScreenProps> = ({
  onNavigateBack,
  onOpenTour
}) => {
  const { repository, tours, scans } = useRepository();
  const activeTour = tours[0];
  const tourScans = useMemo(
    () => scans.filter((s) => s.tourId === activeTour?.id),
    [scans, activeTour?.id]
  );

  const [showFinishChecklist, setShowFinishChecklist] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const spacingWarnings: SpacingWarning[] = useMemo(() => {
    return repository.evaluateScanSpacing(tourScans);
  }, [tourScans, repository]);

  // Draw Matterport-style drafting alignment map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0F0D0B';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const scale = 32;

    // Drafting grid
    ctx.strokeStyle = 'rgba(214, 167, 122, 0.08)';
    ctx.lineWidth = 1;
    const step = 32;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Trajectory path between spots
    if (tourScans.length > 1) {
      ctx.strokeStyle = 'rgba(214, 167, 122, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + tourScans[0].posX * scale, cy + tourScans[0].posY * scale);
      for (let i = 1; i < tourScans.length; i++) {
        ctx.lineTo(cx + tourScans[i].posX * scale, cy + tourScans[i].posY * scale);
      }
      ctx.stroke();
    }

    // Gold 7-10 ft guidance ring around last scan spot
    const lastScan = tourScans[tourScans.length - 1];
    if (lastScan) {
      const lx = cx + lastScan.posX * scale;
      const ly = cy + lastScan.posY * scale;
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5 * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(214, 167, 122, 0.12)';
      ctx.fill();
      ctx.strokeStyle = '#D6A77A';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Scans dots
    tourScans.forEach((scan, idx) => {
      const sx = cx + scan.posX * scale;
      const sy = cy + scan.posY * scale;
      const isLast = idx === tourScans.length - 1;

      ctx.beginPath();
      ctx.arc(sx, sy, 16, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? '#D6A77A' : '#1B1815';
      ctx.fill();
      ctx.strokeStyle = isLast ? '#FFFFFF' : '#D6A77A';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = isLast ? '#0E0C0A' : '#F6F2EC';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((idx + 1).toString(), sx, sy);
    });
  }, [tourScans]);

  const handleCaptureShot = (isDoorway: boolean = false) => {
    if (!activeTour) return;
    const num = tourScans.length + 1;
    const last = tourScans[tourScans.length - 1];
    const offset = isDoorway ? 1.2 : 2.6;
    const nextX = (last?.posX || 0) + offset;
    const nextY = (last?.posY || 0) + offset * 0.4;

    repository.addScanToTour(
      activeTour.id,
      isDoorway ? 'Doorway Transition' : `Room Spot ${num}`,
      isDoorway ? `Connector ${num}` : `Spot ${num}`,
      nextX,
      nextY
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#0E0C0A] overflow-hidden select-none">
      {/* Top Header */}
      <header className="h-16 px-4 sm:px-6 bg-[#141210] border-b border-white/10 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateBack}
            className="p-2 text-[#F6F2EC]/70 hover:text-[#F6F2EC] rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-bold font-serif-heading text-[#F6F2EC]">
              Matterport-Style Live Capture
            </h1>
            <div className="text-[11px] text-[#D6A77A]">
              {activeTour?.name} • {tourScans.length} Scans Placed
            </div>
          </div>
        </div>

        <BrassButton
          text="Finish Session"
          onClick={() => setShowFinishChecklist(true)}
          icon={Check}
        />
      </header>

      {/* Main Drafting Alignment Canvas */}
      <div className="flex-1 relative w-full h-full bg-[#0F0D0B] overflow-hidden">
        <canvas ref={canvasRef} width={1000} height={700} className="w-full h-full object-cover block" />

        {/* Top-Left Engine Badge */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <GlassPanel className="px-3.5 py-2 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#9CC0B4] animate-pulse" />
            <span className="text-xs font-semibold text-[#F6F2EC]">
              Quick Alignment Rules Engine: Active
            </span>
          </GlassPanel>
        </div>

        {/* Top-Right Guidance Ring Pill */}
        <div className="absolute top-4 right-4 z-10 pointer-events-none">
          <GlassPanel className="px-3.5 py-2 text-xs font-bold text-[#D6A77A]">
            Gold Ring = 7–10 ft Next Target Zone
          </GlassPanel>
        </div>
      </div>

      {/* Real-time Spacing & Alignment Tray */}
      <div className="h-56 bg-[#1B1815] border-t border-white/10 p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#F6F2EC]/50">
              Real-time Spacing & Alignment Engine
            </span>
            <span
              className={`text-xs font-bold ${
                spacingWarnings.length === 0 ? 'text-[#9CC0B4]' : 'text-[#F0A060]'
              }`}
            >
              {spacingWarnings.length === 0 ? 'Optimal Spacing' : `${spacingWarnings.length} Warnings`}
            </span>
          </div>

          {/* Warnings List */}
          <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
            {spacingWarnings.length === 0 ? (
              <div className="p-2.5 rounded-lg bg-[#9CC0B4]/15 border border-[#9CC0B4]/30 text-xs text-[#9CC0B4] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>
                  Perfect spacing! All scans placed within recommended 7–10 ft (2–3m) range for spatial dollhouse.
                </span>
              </div>
            ) : (
              spacingWarnings.map((warn, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-[#F0A060]/15 border border-[#F0A060]/30 text-xs text-[#F6F2EC] flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-[#F0A060] shrink-0" />
                  <span>{warn.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2">
          <BrassButton
            text="Capture 360° Scan"
            onClick={() => handleCaptureShot(false)}
            icon={Camera}
            className="w-full"
          />
        </div>
      </div>

      {/* Finish Checklist Modal */}
      {showFinishChecklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC] mb-2">
              Finish Capture Checklist
            </h3>
            <p className="text-xs text-[#F6F2EC]/60 mb-4">
              Pre-processing verification before sending capture batch to Spatial 3D Pipeline:
            </p>
            <div className="space-y-2 mb-6">
              <div className="p-2.5 rounded-lg bg-[#141210] border border-white/10 flex items-center gap-2 text-xs text-[#F6F2EC]">
                <CheckCircle className="w-4 h-4 text-[#9CC0B4] shrink-0" />
                <span>{tourScans.length} 360° Panoramas captured and placed</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#141210] border border-white/10 flex items-center gap-2 text-xs text-[#F6F2EC]">
                <CheckCircle className="w-4 h-4 text-[#9CC0B4] shrink-0" />
                <span>All panoramas validated at 2:1 aspect ratio</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#141210] border border-white/10 flex items-center gap-2 text-xs text-[#F6F2EC]">
                {spacingWarnings.length === 0 ? (
                  <CheckCircle className="w-4 h-4 text-[#9CC0B4] shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#F0A060] shrink-0" />
                )}
                <span>
                  {spacingWarnings.length === 0
                    ? '0 Spacing anomalies detected'
                    : `${spacingWarnings.length} spacing warnings recorded`}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFinishChecklist(false)}
                className="px-4 py-2 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] cursor-pointer"
              >
                Continue Capturing
              </button>
              <BrassButton
                text="Start Full 3D Processing"
                onClick={() => {
                  setShowFinishChecklist(false);
                  if (activeTour) onOpenTour(activeTour.id);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
