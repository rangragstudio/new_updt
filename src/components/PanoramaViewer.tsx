import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
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
  ExternalLink,
  AlertCircle,
  Loader2
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
  const mountRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);

  const [isLoadingTexture, setIsLoadingTexture] = useState(false);
  const [textureError, setTextureError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ContentItem | null>(null);

  // References to Three.js entities for dynamic camera updates
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const currentTextureRef = useRef<THREE.Texture | null>(null);

  // 1. Initialize Three.js Scene, Camera, Equirectangular Sphere, Renderer
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // A. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // B. Perspective Camera at center (0, 0, 0)
    const camera = new THREE.PerspectiveCamera(zoomFov, width / height, 0.1, 1000);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    // C. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // D. True Equirectangular Sphere (inward facing UVs)
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    // Invert geometry along X axis so texture faces inward toward the camera at (0, 0, 0)
    geometry.scale(-1, 1, 1);

    const material = new THREE.MeshBasicMaterial({
      color: 0x141210
    });

    const sphereMesh = new THREE.Mesh(geometry, material);
    scene.add(sphereMesh);
    meshRef.current = sphereMesh;

    // E. Render Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // F. Resize Observer
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (currentTextureRef.current) {
        currentTextureRef.current.dispose();
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Load the actual uploaded image as equirectangular panorama texture
  const activeImageUrl = currentScan?.fileUrl || currentScan?.tileManifest?.previewUrl;

  useEffect(() => {
    if (!activeImageUrl) {
      setTextureError(null);
      setIsLoadingTexture(false);
      if (meshRef.current) {
        const mat = meshRef.current.material as THREE.MeshBasicMaterial;
        mat.map = null;
        mat.color.set(0x141210);
        mat.needsUpdate = true;
      }
      return;
    }

    setIsLoadingTexture(true);
    setTextureError(null);

    const loader = new THREE.TextureLoader();
    loader.load(
      activeImageUrl,
      (texture) => {
        if (currentTextureRef.current) {
          currentTextureRef.current.dispose();
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

        currentTextureRef.current = texture;

        if (meshRef.current) {
          const mat = meshRef.current.material as THREE.MeshBasicMaterial;
          mat.map = texture;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        }

        setIsLoadingTexture(false);
      },
      undefined,
      (err) => {
        console.error('Failed to load equirectangular panorama texture:', err);
        setIsLoadingTexture(false);
        setTextureError('Unable to load uploaded panorama image.');
      }
    );
  }, [activeImageUrl]);

  // 3. Update Camera Rotation & FOV based on panYaw, panPitch, zoomFov
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    // FOV update
    const clampedFov = Math.max(40, Math.min(110, zoomFov));
    if (camera.fov !== clampedFov) {
      camera.fov = clampedFov;
      camera.updateProjectionMatrix();
    }

    // Convert panYaw and panPitch into 3D Spherical Coordinates
    // panPitch clamped between -85° and 85° to prevent excessive vertical flipping
    const clampedPitch = Math.max(-85, Math.min(85, panPitch));
    const phi = THREE.MathUtils.degToRad(90 - clampedPitch);
    const theta = THREE.MathUtils.degToRad(panYaw);

    const targetX = 500 * Math.sin(phi) * Math.cos(theta);
    const targetY = 500 * Math.cos(phi);
    const targetZ = 500 * Math.sin(phi) * Math.sin(theta);

    camera.lookAt(targetX, targetY, targetZ);
  }, [panYaw, panPitch, zoomFov]);

  // 4. Pointer & Drag Controls (Mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    // Sensitivity scaled by current FOV
    const factor = (zoomFov / 80) * 0.22;
    onPanChange(-dx * factor, -dy * factor);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // 5. Touch Controls (Single Finger Pan, Pinch to Zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchDistanceRef.current = null;
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - lastMousePosRef.current.x;
      const dy = e.touches[0].clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      const factor = (zoomFov / 80) * 0.22;
      onPanChange(-dx * factor, -dy * factor);
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      const delta = touchDistanceRef.current - newDistance;
      touchDistanceRef.current = newDistance;

      if (Math.abs(delta) > 2) {
        onZoomChange(delta * 0.3);
      }
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchDistanceRef.current = null;
  };

  // 6. Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onZoomChange(e.deltaY > 0 ? 5 : -5);
  };

  const headingDeg = Math.round(((panYaw % 360) + 360) % 360);

  // Helper to project spherical yaw/pitch to 2D screen percentage coordinates
  const getScreenCoordinates = (yaw: number, pitch: number) => {
    if (!cameraRef.current) return null;
    const phi = THREE.MathUtils.degToRad(90 - pitch);
    const theta = THREE.MathUtils.degToRad(yaw);

    const pos = new THREE.Vector3(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );

    pos.project(cameraRef.current);

    // If pos.z > 1, the point is behind the camera frustum
    if (pos.z > 1) return null;

    const leftPct = (pos.x * 0.5 + 0.5) * 100;
    const topPct = (-pos.y * 0.5 + 0.5) * 100;

    return { leftPct, topPct };
  };

  return (
    <div
      ref={mountRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className={`relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-[#0E0C0A] ${className}`}
    >
      {/* Texture Loading Overlay */}
      {isLoadingTexture && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <Loader2 className="w-8 h-8 text-[#D6A77A] animate-spin mb-2" />
          <span className="text-xs font-medium text-[#F6F2EC]">
            Loading 360° Panorama...
          </span>
        </div>
      )}

      {/* Empty / Error State (No demo image fallback) */}
      {!activeImageUrl && !isLoadingTexture && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#0E0C0A] text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-3 shadow-lg">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC] mb-1">
            No Panorama Image Attached
          </h3>
          <p className="text-xs text-[#F6F2EC]/60 max-w-sm mb-2">
            This scan does not have an uploaded 360° equirectangular image file.
          </p>
        </div>
      )}

      {textureError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#0E0C0A] text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-[#E07A6A] mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[#F6F2EC] mb-1">
            Unable to Display Panorama
          </h3>
          <p className="text-xs text-[#F6F2EC]/60 max-w-sm">{textureError}</p>
        </div>
      )}

      {/* OVERLAY 1: Top-Left Room & View Card */}
      <div className="absolute top-4 left-4 z-10 pointer-events-auto">
        <GlassPanel className="px-3.5 py-2 flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D6A77A] animate-pulse" />
          <div>
            <div className="text-xs font-bold text-[#F6F2EC]">
              {currentScan?.roomName || 'Overview'}
            </div>
            <div className="text-[11px] text-[#F6F2EC]/70">
              {currentScan?.originalFile ? currentScan.originalFile.name : (currentScan?.name || 'Main Camera Spot')}
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* OVERLAY 2: Top-Center Camera View Status */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden sm:block">
        <GlassPanel className="px-3.5 py-1.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#9CC0B4]" />
          <span className="text-[11px] font-medium text-[#F6F2EC]">
            360° Equirectangular • FOV {Math.round(zoomFov)}°
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
          onClick={() => onZoomChange(-10)}
          title="Zoom in"
          className="w-9 h-9 rounded-full bg-[#1B1815]/80 hover:bg-[#D6A77A]/20 active:scale-95 border border-white/15 flex items-center justify-center text-[#F6F2EC] transition-all cursor-pointer backdrop-blur-md"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(10)}
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
        const coords = getScreenCoordinates(link.yaw, link.pitch);
        if (!coords) return null;

        return (
          <div
            key={link.id}
            style={{ left: `${coords.leftPct}%`, top: `${coords.topPct}%` }}
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
        const coords = getScreenCoordinates(item.yaw, item.pitch);
        if (!coords) return null;

        return (
          <div
            key={item.id}
            style={{ left: `${coords.leftPct}%`, top: `${coords.topPct}%` }}
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
