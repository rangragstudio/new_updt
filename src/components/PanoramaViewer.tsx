import React, { useRef, useState, useEffect } from 'react';
import {
  Compass,
  Plus,
  Minus,
  RotateCcw,
  Footprints,
  Tag,
  Info,
  X,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { Scan, Link, ContentItem, Tour } from '../types/models';
import { GlassPanel } from './UIPrimitives';

interface PanoramaViewerProps {
  tour: Tour;
  currentScan?: Scan;
  links: Link[];
  contentItems: ContentItem[];
  panYaw: number;
  panPitch: number;
  zoomFov: number;
  onPanChange: (dyaw: number, dpitch: number) => void;
  onZoomChange: (delta: number) => void;
  onResetView: () => void;
  onLinkClick: (targetScanId: string) => void;
  className?: string;
  studioWhatsapp?: string;
}

export const PanoramaViewer: React.FC<PanoramaViewerProps> = ({
  tour,
  currentScan,
  links,
  contentItems,
  panYaw,
  panPitch,
  zoomFov,
  onPanChange,
  onZoomChange,
  onResetView,
  onLinkClick,
  className = '',
  studioWhatsapp = '+91 98250 12345'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const [selectedProduct, setSelectedProduct] = useState<ContentItem | null>(null);

  // Render the architectural 360 panorama projection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

      const cx = w / 2;
      const cy = h / 2;
      const fovScale = 90 / Math.max(40, Math.min(110, zoomFov));
      const floorHorizon = cy + panPitch * 4.5 * fovScale;

      // 1. Ceiling ambient architectural gradient
      const ceilingGrad = ctx.createLinearGradient(0, 0, 0, Math.max(1, floorHorizon));
      ceilingGrad.addColorStop(0, '#0C0A09');
      ceilingGrad.addColorStop(1, '#1A1613');
      ctx.fillStyle = ceilingGrad;
      ctx.fillRect(0, 0, w, Math.max(0, floorHorizon));

      // 2. Flooring ambient architectural gradient (warm Italian marble / hardwood floor)
      const floorGrad = ctx.createLinearGradient(0, floorHorizon, 0, h);
      floorGrad.addColorStop(0, '#26201B');
      floorGrad.addColorStop(1, '#13110E');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, floorHorizon, w, Math.max(0, h - floorHorizon));

      // 3. Perspective architectural pillars, panoramic windows, and lighting casts
      ctx.save();
      for (let i = 0; i < 16; i++) {
        const angleDeg = (i * 22.5 + panYaw) % 360;
        const rad = (angleDeg * Math.PI) / 180;

        if (Math.cos(rad) > 0) {
          // In front of viewer
          const xPos = cx + Math.sin(rad) * (w * 0.75 * fovScale);

          // Vertical architectural column
          ctx.strokeStyle = 'rgba(214, 167, 122, 0.22)';
          ctx.lineWidth = Math.max(1, 2.5 * fovScale);
          ctx.beginPath();
          ctx.moveTo(xPos, floorHorizon - h * 0.45 * fovScale);
          ctx.lineTo(xPos, floorHorizon + 70);
          ctx.stroke();

          // Warm architectural recessed window light
          if (i % 3 === 0) {
            ctx.fillStyle = 'rgba(214, 167, 122, 0.08)';
            ctx.fillRect(
              xPos - 45 * fovScale,
              floorHorizon - h * 0.4 * fovScale,
              90 * fovScale,
              h * 0.4 * fovScale
            );
          }
        }
      }
      ctx.restore();

      // 4. Baseboard architectural line
      ctx.strokeStyle = 'rgba(214, 167, 122, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, floorHorizon);
      ctx.lineTo(w, floorHorizon);
      ctx.stroke();

      // 5. Subtle viewpoint crosshair in center
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();
    };

    render();

    // Resize listener
    const handleResize = () => {
      if (containerRef.current && canvas) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
        render();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [panYaw, panPitch, zoomFov]);

  // Pointer Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    onPanChange(-dx * 0.28, -dy * 0.22);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastMousePosRef.current.x;
    const dy = e.touches[0].clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    onPanChange(-dx * 0.28, -dy * 0.22);
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onZoomChange(e.deltaY > 0 ? 5 : -5);
  };

  // Dynamic Tile resolution level calculation
  const currentTileLevel = zoomFov < 60 ? 4 : zoomFov < 80 ? 3 : 2;
  const resLabel = currentTileLevel === 4 ? '8K Crisp' : currentTileLevel === 3 ? '4K HD' : '2K Fast';
  const headingDeg = Math.round(((panYaw % 360) + 360) % 360);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className={`relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-[#1A1714] ${className}`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* OVERLAY 1: Top-Left Room & View Card */}
      <div className="absolute top-4 left-4 z-10 pointer-events-auto">
        <GlassPanel className="px-3.5 py-2 flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D6A77A] animate-pulse" />
          <div>
            <div className="text-xs font-bold text-[#F6F2EC]">
              {currentScan?.roomName || 'Overview'}
            </div>
            <div className="text-[11px] text-[#F6F2EC]/70">
              {currentScan?.name || 'Main Camera Spot'}
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* OVERLAY 2: Top-Center Progressive 8K Tile Manifest Status */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden sm:block">
        <GlassPanel className="px-3.5 py-1.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#9CC0B4]" />
          <span className="text-[11px] font-medium text-[#F6F2EC]">
            Tiles: Level {currentTileLevel} ({resLabel}) • FOV {Math.round(zoomFov)}°
          </span>
        </GlassPanel>
      </div>

      {/* OVERLAY 3: Top-Right Compass Heading */}
      <div className="absolute top-4 right-4 z-10 pointer-events-auto">
        <GlassPanel className="px-3.5 py-1.5 flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#D6A77A]" />
          <span className="text-[11px] font-medium text-[#F6F2EC]">
            Heading: {headingDeg}°
          </span>
        </GlassPanel>
      </div>

      {/* OVERLAY 4: Right Floating Zoom & Reset Navigation Controls */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onZoomChange(-15)}
          title="Zoom in"
          className="w-9 h-9 rounded-full bg-[#1B1815]/80 hover:bg-[#D6A77A]/20 active:scale-95 border border-white/15 flex items-center justify-center text-[#F6F2EC] transition-all cursor-pointer backdrop-blur-md"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(15)}
          title="Zoom out"
          className="w-9 h-9 rounded-full bg-[#1B1815]/80 hover:bg-[#D6A77A]/20 active:scale-95 border border-white/15 flex items-center justify-center text-[#F6F2EC] transition-all cursor-pointer backdrop-blur-md"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onResetView}
          title="Reset orientation"
          className="w-9 h-9 rounded-full bg-[#1B1815]/80 hover:bg-[#D6A77A]/20 active:scale-95 border border-white/15 flex items-center justify-center text-[#D6A77A] transition-all cursor-pointer backdrop-blur-md"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* OVERLAY 5: Interactive Navigation Hotspots (Floor Rings) */}
      {links.map((link) => {
        const relYaw = ((link.yaw - panYaw + 540) % 360) - 180;
        if (relYaw < -80 || relYaw > 80) return null;

        const leftPct = 50 + (relYaw / 80) * 45;
        const topPct = 68 + (link.pitch / 50) * 15;

        return (
          <div
            key={link.id}
            style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onLinkClick(link.targetScanId);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center cursor-pointer group transition-transform duration-200 hover:scale-110"
          >
            <div className="w-12 h-12 rounded-full bg-[#D6A77A]/25 border-2 border-[#D6A77A] flex items-center justify-center shadow-lg group-hover:bg-[#D6A77A] transition-colors">
              <Footprints className="w-6 h-6 text-[#F6F2EC] group-hover:text-[#0E0C0A] transition-colors" />
            </div>
            <div className="mt-1 px-2.5 py-1 rounded-md bg-[rgba(22,20,18,0.85)] border border-white/15 backdrop-blur-md text-[11px] font-semibold text-[#F6F2EC] whitespace-nowrap shadow-md">
              {link.label}
            </div>
          </div>
        );
      })}

      {/* OVERLAY 6: Interactive Product POI Cards */}
      {contentItems.map((item) => {
        const relYaw = ((item.yaw - panYaw + 540) % 360) - 180;
        if (relYaw < -80 || relYaw > 80) return null;

        const leftPct = 50 + (relYaw / 80) * 45;
        const topPct = 48 + (item.pitch / 50) * 22;

        return (
          <div
            key={item.id}
            style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedProduct(item);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center cursor-pointer group transition-transform duration-200 hover:scale-110"
          >
            <div className="w-10 h-10 rounded-full bg-[#1B1815] border-2 border-[#D6A77A] flex items-center justify-center shadow-lg group-hover:bg-[#D6A77A] transition-colors">
              {item.type === 'PRODUCT' ? (
                <Tag className="w-5 h-5 text-[#D6A77A] group-hover:text-[#0E0C0A] transition-colors" />
              ) : (
                <Info className="w-5 h-5 text-[#D6A77A] group-hover:text-[#0E0C0A] transition-colors" />
              )}
            </div>
            <div className="mt-1 px-2 py-0.5 rounded-md bg-[rgba(22,20,18,0.85)] border border-[#D6A77A]/40 backdrop-blur-md text-[10px] font-bold text-[#D6A77A] whitespace-nowrap">
              {item.priceInr ? `₹${item.priceInr.toLocaleString('en-IN')}` : item.title}
            </div>
          </div>
        );
      })}

      {/* OVERLAY 7: Floating Selected Product Card (WhatsApp CTA) */}
      {selectedProduct && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-lg pointer-events-auto">
          <GlassPanel className="p-4 border-[#D6A77A]/30">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#D6A77A]/20 flex items-center justify-center text-[#D6A77A] shrink-0">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#F6F2EC]">{selectedProduct.title}</h4>
                  {selectedProduct.brand && (
                    <span className="text-[11px] text-[#D6A77A] font-medium">
                      {selectedProduct.brand}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-1 text-[#F6F2EC]/60 hover:text-[#F6F2EC] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#F6F2EC]/75 mb-3 leading-relaxed">
              {selectedProduct.description}
            </p>

            {selectedProduct.dimensions && (
              <div className="text-[11px] text-[#F6F2EC]/55 mb-3">
                Dimensions: {selectedProduct.dimensions}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#F6F2EC]/50 font-semibold">
                  Price (Estimate)
                </div>
                <div className="text-lg font-bold font-serif-heading text-[#F6F2EC]">
                  ₹{selectedProduct.priceInr ? selectedProduct.priceInr.toLocaleString('en-IN') : 'Enquire'}
                </div>
              </div>

              {/* WhatsApp direct inquiry CTA */}
              <a
                href={`https://wa.me/${studioWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Hello, I am interested in '${selectedProduct.title}' (Price: ₹${
                    selectedProduct.priceInr || 'On request'
                  }) seen in '${currentScan?.roomName || 'Room'}' of virtual tour '${tour.name}'.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-3.5 rounded-[10px] bg-[#9CC0B4] text-[#0E0C0A] hover:bg-[#b0d2c7] text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Enquire on WhatsApp</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};
