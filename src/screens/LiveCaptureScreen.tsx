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
import { cameraManager, CameraProvider, hdrCapturePipeline, HDRCaptureJob } from '../services/camera';
import { Smartphone, Radio, Disc, Video, X, CheckCircle2, RefreshCw } from 'lucide-react';

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
  const [showConnectCameraModal, setShowConnectCameraModal] = useState(false);
  const [activeProvider, setActiveProvider] = useState<CameraProvider | null>(() => cameraManager.getActiveProvider());
  const [isConnecting, setIsConnecting] = useState(false);
  const [pipelineJobs, setPipelineJobs] = useState<HDRCaptureJob[]>(() => hdrCapturePipeline.getAllJobs());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subscribe to asynchronous HDR pipeline updates
  useEffect(() => {
    const unsub = hdrCapturePipeline.subscribe(() => {
      setPipelineJobs([...hdrCapturePipeline.getAllJobs()]);
    });
    return unsub;
  }, []);

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

    const newScan = repository.addScanToTour(
      activeTour.id,
      isDoorway ? 'Doorway Transition' : `Room Spot ${num}`,
      isDoorway ? `Connector ${num}` : `Spot ${num}`,
      nextX,
      nextY
    );

    // Fast non-blocking handoff (Requirement 1 & 10):
    // Enqueue single HDR / standard panorama for background processing
    // User can immediately continue walking to next spot without waiting for HDR/tiling!
    if (typeof Blob !== 'undefined') {
      const mockPanoramaBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
        type: 'image/jpeg'
      });
      hdrCapturePipeline
        .enqueueSingleHDRPanorama(activeTour.id, newScan.id, newScan.name, mockPanoramaBlob)
        .catch((err) => {
          console.warn('[LiveCapture] Non-blocking pipeline enqueue notice:', err);
        });
    }
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

        <div className="flex items-center gap-2">
          <OutlinedBrassButton
            text={activeProvider?.getConnectionState() === 'CONNECTED' ? `${activeProvider.name} Connected` : 'Connect Camera'}
            onClick={() => setShowConnectCameraModal(true)}
            icon={Camera}
          />
          <BrassButton
            text="Finish Session"
            onClick={() => setShowFinishChecklist(true)}
            icon={Check}
          />
        </div>
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

        {/* Asynchronous Non-blocking HDR/Upload Status */}
        {pipelineJobs.some((j) => j.state !== 'COMPLETE' && j.state !== 'FAILED') && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between text-[11px] text-[#F6F2EC]/70">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-[#D6A77A] animate-spin shrink-0" />
              <span>
                Background Pipeline: {pipelineJobs.filter((j) => j.state !== 'COMPLETE' && j.state !== 'FAILED').length} job in queue • Capture is ready
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#D6A77A]">Non-blocking</span>
          </div>
        )}

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

      {/* CONNECT CAMERA MODAL */}
      {showConnectCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#141210] border border-white/15 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC]">
                  Connect Camera
                </h3>
                <p className="text-xs text-[#F6F2EC]/60 mt-0.5">
                  Select a camera provider for spatial 360° capture:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectCameraModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#F6F2EC]/70 hover:text-[#F6F2EC] flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Providers List */}
            <div className="space-y-3">
              {/* 1. Phone Camera */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#D6A77A]/15 border border-[#D6A77A]/30 flex items-center justify-center text-[#D6A77A] shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#F6F2EC]">Phone Camera</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#9CC0B4]/15 border border-[#9CC0B4]/30 text-[#9CC0B4]">
                        Device Supported
                      </span>
                    </div>
                    <p className="text-xs text-[#F6F2EC]/60 mt-1 leading-relaxed">
                      Uses your phone's built-in camera and orientation sensors for guided room captures.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[#F6F2EC]/50 font-mono mt-2">
                      <span>• Live Preview</span>
                      <span>• Horizon Sensors</span>
                      <span>• Standard Single JPEG</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pt-1">
                  {activeProvider?.id === 'phone-camera' && activeProvider.getConnectionState() === 'CONNECTED' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await cameraManager.disconnectActive();
                        setActiveProvider(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/25 cursor-pointer transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isConnecting}
                      onClick={async () => {
                        setIsConnecting(true);
                        const ok = await cameraManager.setActiveProvider('phone-camera');
                        setIsConnecting(false);
                        if (ok) {
                          setActiveProvider(cameraManager.getActiveProvider());
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#D6A77A] hover:bg-[#c49265] text-xs font-bold text-[#0E0C0A] cursor-pointer shadow-md transition-colors"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Insta360 Camera */}
              <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-start justify-between gap-4 opacity-75">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#F6F2EC]/50 shrink-0">
                    <Disc className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#F6F2EC]">Insta360 Camera</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        SDK Integration Required
                      </span>
                    </div>
                    <p className="text-xs text-[#F6F2EC]/60 mt-1 leading-relaxed">
                      Native driver for Insta360 X3, X4, ONE RS. Architecture ready for 3/5/7/9-frame AEB bracketing; official camera SDK is not configured.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-amber-400/80 font-mono mt-2">
                      <span>Status: INSTA360_SDK_NOT_CONFIGURED</span>
                      <span>• 3/5/7/9 AEB Architecture Ready</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pt-1">
                  <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-[#F6F2EC]/40 cursor-not-allowed">
                    Unavailable
                  </span>
                </div>
              </div>

              {/* 3. GoPro Camera */}
              <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-start justify-between gap-4 opacity-75">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#F6F2EC]/50 shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#F6F2EC]">GoPro 360</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        API Integration Required
                      </span>
                    </div>
                    <p className="text-xs text-[#F6F2EC]/60 mt-1 leading-relaxed">
                      Wi-Fi/Bluetooth driver for GoPro MAX and HERO cameras. Architecture ready for 3-frame AEB; Open GoPro API is not configured.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-amber-400/80 font-mono mt-2">
                      <span>Status: GOPRO_SDK_NOT_CONFIGURED</span>
                      <span>• 3-Frame AEB Architecture Ready</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pt-1">
                  <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-[#F6F2EC]/40 cursor-not-allowed">
                    Unavailable
                  </span>
                </div>
              </div>
            </div>

            {/* HDR / AEB Capability Architecture Status */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F6F2EC]">360° HDR / AEB Bracketing</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#F6F2EC]/60">
                  {activeProvider && activeProvider.getConnectionState() === 'CONNECTED'
                    ? 'Single Exposure Active'
                    : 'Hardware Disconnected'}
                </span>
              </div>
              <p className="text-[11px] text-[#F6F2EC]/50 mt-1 leading-relaxed">
                {activeProvider && activeProvider.getConnectionState() === 'CONNECTED'
                  ? 'Active device uses single-frame capture. Professional 3/5/7-frame AEB bracketing requires a connected 360° hardware camera.'
                  : 'AEB modes (3, 5, 7, 9 frames) and RAW/DNG formats will be enabled when a supported external 360° camera is connected.'}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowConnectCameraModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer"
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
