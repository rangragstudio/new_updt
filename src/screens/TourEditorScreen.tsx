import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  Undo2,
  Redo2,
  Globe,
  Layers,
  Link2,
  Tag,
  Map as MapIcon,
  Box as BoxIcon,
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Flag,
  Plus,
  Trash2,
  Upload,
  FileCode,
  AlertCircle
} from 'lucide-react';
import { useRepository } from '../hooks/useRepository';
import { Tour, Scan, Link, ContentItem, RenderPackage } from '../types/models';
import { StatusBadge } from '../components/StatusBadge';
import { BrassButton, OutlinedBrassButton } from '../components/UIPrimitives';
import { PanoramaViewer } from '../components/PanoramaViewer';
import { FloorPlanViewer } from '../components/FloorPlanViewer';
import { DollhouseViewer } from '../components/DollhouseViewer';

export type EditorTab = 'SCANS' | 'LINKS' | 'CONTENT' | 'PLAN' | 'DOLLHOUSE_3D' | 'SETTINGS';

interface TourEditorScreenProps {
  tourId: string;
  onNavigateBack: () => void;
  onOpenPublishModal: (tourId: string) => void;
}

export const TourEditorScreen: React.FC<TourEditorScreenProps> = ({
  tourId,
  onNavigateBack,
  onOpenPublishModal
}) => {
  const { repository, tours, scans, links, contentItems, floorPlans, currentOrg } =
    useRepository();

  const tour = tours.find((t) => t.id === tourId) || tours[0];
  const tourScans = useMemo(() => scans.filter((s) => s.tourId === tour?.id), [scans, tour?.id]);

  const [activeScanId, setActiveScanId] = useState<string>(
    tourScans.find((s) => s.isStartScan)?.id || tourScans[0]?.id || ''
  );
  const [selectedTab, setSelectedTab] = useState<EditorTab>('SCANS');

  // Camera orientation & FOV state
  const [panYaw, setPanYaw] = useState(0);
  const [panPitch, setPanPitch] = useState(0);
  const [zoomFov, setZoomFov] = useState(90);

  // Dialog states
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [showPlanUpload, setShowPlanUpload] = useState(false);
  const [showImportPackage, setShowImportPackage] = useState(false);

  // New product form
  const [prodTitle, setProdTitle] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodBrand, setProdBrand] = useState('');
  const [prodDims, setProdDims] = useState('');
  const [prodDesc, setProdDesc] = useState('');

  // New link form
  const [linkTargetId, setLinkTargetId] = useState(
    tourScans.find((s) => s.id !== activeScanId)?.id || ''
  );
  const [linkLabel, setLinkLabel] = useState('');

  // Floor plan upload form
  const [planLevel, setPlanLevel] = useState('Ground Floor');
  const [planTitle, setPlanTitle] = useState('Architectural Floor Layout');
  const [planFormat, setPlanFormat] = useState<'PNG' | 'SVG' | 'AutoCAD DXF'>('PNG');

  // Active scan & relevant items
  const currentScan = tourScans.find((s) => s.id === activeScanId) || tourScans[0];
  const scanLinks = links.filter((l) => l.scanId === activeScanId);
  const scanItems = contentItems.filter((c) => c.scanId === activeScanId);

  // Handlers
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle.trim()) return;
    repository.addProductCard(
      activeScanId,
      panYaw,
      panPitch,
      prodTitle,
      parseFloat(prodPrice) || 0,
      prodDesc,
      prodBrand,
      prodDims
    );
    setShowAddProduct(false);
    setProdTitle('');
    setProdPrice('');
    setProdBrand('');
    setProdDims('');
    setProdDesc('');
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTargetId) return;
    const targetScan = tourScans.find((s) => s.id === linkTargetId);
    const label = linkLabel.trim() || `Walk to ${targetScan?.roomName || 'Room'}`;
    repository.addLink(
      activeScanId,
      linkTargetId,
      targetScan?.name || 'Target Spot',
      panYaw,
      -12,
      label
    );
    setShowAddLink(false);
    setLinkLabel('');
  };

  const handlePlanUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (planFormat === 'AutoCAD DXF') return;
    repository.addFloorPlan(tour.id, planLevel, planTitle, planFormat);
    setShowPlanUpload(false);
  };

  const handleImportSamplePackage = () => {
    const samplePackage: RenderPackage = {
      name: 'Skyline Royal Penthouse (V-Ray 6)',
      source: 'sketchup+vray',
      checksum: `sha256-skyline-${Date.now()}`,
      scans: [
        { id: 'Grand Foyer', room: 'Entrance Foyer', image: 'foyer.jpg', posX: 0, posY: 0, rotationYaw: 0 },
        { id: 'Living Hall', room: 'Living Room', image: 'living.jpg', posX: 2.8, posY: 0.5, rotationYaw: 40 },
        { id: 'Master Deck', room: 'Master Bedroom', image: 'deck.jpg', posX: 5.6, posY: 2.0, rotationYaw: 90 }
      ]
    };
    repository.importRenderPackage(samplePackage);
    setShowImportPackage(false);
  };

  if (!tour) return null;

  return (
    <div className="flex flex-col h-screen bg-[#141210] overflow-hidden select-none">
      {/* 1. TOP BAR */}
      <header className="h-16 px-4 lg:px-6 bg-[#141210] border-b border-white/10 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateBack}
            className="p-2 text-[#F6F2EC]/70 hover:text-[#F6F2EC] rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold font-serif-heading text-[#F6F2EC]">
                {tour.name}
              </h1>
              <StatusBadge status={tour.status} />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#9CC0B4]">
              <CheckCircle className="w-3 h-3" />
              <span>Autosaved to R2 Cloud Storage</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Undo"
            className="p-2 text-[#F6F2EC]/60 hover:text-[#F6F2EC] rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Redo"
            className="p-2 text-[#F6F2EC]/60 hover:text-[#F6F2EC] rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <BrassButton
            text="Publish Tour"
            onClick={() => onOpenPublishModal(tour.id)}
            icon={Globe}
          />
        </div>
      </header>

      {/* 2. TAB STRIP (6 TABS) */}
      <nav className="flex items-center gap-1 px-4 lg:px-6 bg-[#1B1815] border-b border-white/10 overflow-x-auto shrink-0 py-1.5">
        {[
          { tab: 'SCANS' as EditorTab, label: `Scans (${tourScans.length})`, icon: Layers },
          { tab: 'LINKS' as EditorTab, label: `Links (${scanLinks.length})`, icon: Link2 },
          { tab: 'CONTENT' as EditorTab, label: 'Content / Products', icon: Tag },
          { tab: 'PLAN' as EditorTab, label: '2D Floor Plan', icon: MapIcon },
          { tab: 'DOLLHOUSE_3D' as EditorTab, label: '3D Dollhouse', icon: BoxIcon },
          { tab: 'SETTINGS' as EditorTab, label: 'Settings', icon: SettingsIcon }
        ].map((item) => {
          const isSelected = selectedTab === item.tab;
          const Icon = item.icon;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => setSelectedTab(item.tab)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#D6A77A]/20 text-[#D6A77A]'
                  : 'text-[#F6F2EC]/60 hover:text-[#F6F2EC] hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3. CENTER VIEWPORT */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        {selectedTab === 'PLAN' ? (
          <FloorPlanViewer
            scans={tourScans}
            activeScanId={activeScanId}
            panYaw={panYaw}
            floorPlans={floorPlans}
            onSelectScan={(id) => setActiveScanId(id)}
            onPlacePin={(nx, ny) => {
              if (currentScan && floorPlans.length > 0) {
                repository.addOrUpdateFloorPlanPin(
                  floorPlans[0].id,
                  currentScan.id,
                  currentScan.name,
                  nx,
                  ny,
                  panYaw
                );
              }
            }}
          />
        ) : selectedTab === 'DOLLHOUSE_3D' ? (
          <DollhouseViewer
            tour={tour}
            scans={tourScans}
            activeScanId={activeScanId}
            onSelectScan={(id) => {
              setActiveScanId(id);
              setSelectedTab('SCANS');
            }}
          />
        ) : (
          <PanoramaViewer
            tour={tour}
            currentScan={currentScan}
            links={scanLinks}
            contentItems={scanItems}
            panYaw={panYaw}
            panPitch={panPitch}
            zoomFov={zoomFov}
            onPanChange={(dyaw, dpitch) => {
              setPanYaw((y) => (y + dyaw) % 360);
              setPanPitch((p) => Math.max(-75, Math.min(75, p + dpitch)));
            }}
            onZoomChange={(delta) => {
              setZoomFov((f) => Math.max(40, Math.min(110, f + delta)));
            }}
            onResetView={() => {
              setPanYaw(0);
              setPanPitch(0);
              setZoomFov(90);
            }}
            onLinkClick={(targetId) => {
              setActiveScanId(targetId);
            }}
            studioWhatsapp={currentOrg.whatsappNumber}
          />
        )}
      </main>

      {/* 4. BOTTOM DOCK PANEL */}
      <footer className="h-52 bg-[#1B1815] border-t border-white/10 p-4 overflow-y-auto shrink-0 z-20">
        {/* TAB 1: SCANS */}
        {selectedTab === 'SCANS' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#F6F2EC]/50">
                Room Scans in Tour ({tourScans.length})
              </span>
              <div className="flex items-center gap-2">
                <OutlinedBrassButton
                  text="Process 8K Tiles"
                  onClick={() => {
                    if (currentScan) {
                      repository.triggerPanoramaProcessing(
                        tour.id,
                        currentScan.id,
                        currentScan.name
                      );
                    }
                  }}
                  icon={Layers}
                />
                <button
                  type="button"
                  onClick={() => setShowImportPackage(true)}
                  className="px-3 py-1.5 text-xs text-[#D6A77A] hover:underline cursor-pointer"
                >
                  Import Render Package
                </button>
                <BrassButton
                  text="Add Spot"
                  onClick={() => {
                    const num = tourScans.length + 1;
                    repository.addScanToTour(
                      tour.id,
                      `Room ${num}`,
                      `Panorama Spot ${num}`,
                      num * 2.2,
                      num * 0.8
                    );
                  }}
                  icon={Plus}
                />
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {tourScans.map((scan) => {
                const isSelected = scan.id === activeScanId;
                return (
                  <div
                    key={scan.id}
                    onClick={() => setActiveScanId(scan.id)}
                    className={`min-w-[190px] p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#D6A77A]/15 border-[#D6A77A]'
                        : 'bg-[#141210] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[#D6A77A]">
                          {scan.roomName}
                        </span>
                        {scan.isStartScan && (
                          <span title="Start Scan" className="text-[#D6A77A]">
                            <Flag className="w-3.5 h-3.5 fill-[#D6A77A]" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-[#F6F2EC] mb-2">{scan.name}</div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-[#9CC0B4]">
                      <span>5-Level Tiles</span>
                      <div className="flex items-center gap-1.5 text-[#F6F2EC]/60">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            repository.toggleHideScan(scan.id);
                          }}
                          title={scan.hiddenFromWalkthrough ? 'Show in tour' : 'Hide from tour'}
                          className="hover:text-[#F6F2EC]"
                        >
                          {scan.hiddenFromWalkthrough ? (
                            <EyeOff className="w-3.5 h-3.5 text-[#E07A6A]" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            repository.setStartScan(scan.id, tour.id);
                          }}
                          title="Set as start scan"
                          className={`hover:text-[#D6A77A] ${
                            scan.isStartScan ? 'text-[#D6A77A]' : ''
                          }`}
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: LINKS */}
        {selectedTab === 'LINKS' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#F6F2EC]/50">
                Navigation Hotspots from {currentScan?.roomName}
              </span>
              <BrassButton
                text="Link New Spot"
                onClick={() => setShowAddLink(true)}
                icon={Plus}
              />
            </div>

            {scanLinks.length === 0 ? (
              <p className="text-xs text-[#F6F2EC]/60 py-4">
                No navigation hotspots placed from this camera spot. Click "Link New Spot" to connect adjacent rooms.
              </p>
            ) : (
              <div className="flex gap-2.5 overflow-x-auto pb-2">
                {scanLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-3 rounded-xl bg-[#141210] border border-white/10 flex items-center gap-3 min-w-[200px]"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#D6A77A]/20 flex items-center justify-center text-[#D6A77A]">
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-[#F6F2EC]">{link.label}</div>
                      <div className="text-[10px] text-[#F6F2EC]/60">
                        Target: {link.targetScanName}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => repository.removeLink(link.id)}
                      className="p-1 text-[#E07A6A] hover:bg-red-500/10 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONTENT / PRODUCTS */}
        {selectedTab === 'CONTENT' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#F6F2EC]/50">
                Product & Material Hotspots in {currentScan?.roomName}
              </span>
              <BrassButton
                text="Add Product Card"
                onClick={() => setShowAddProduct(true)}
                icon={Plus}
              />
            </div>

            {scanItems.length === 0 ? (
              <p className="text-xs text-[#F6F2EC]/60 py-4">
                No product cards placed in this room. Click "Add Product Card" to showcase bespoke furnishings with ₹ INR prices and WhatsApp CTA.
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {scanItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#141210] border border-white/10 min-w-[240px] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[#F6F2EC]">{item.title}</span>
                        {item.priceInr && (
                          <span className="text-xs font-bold text-[#D6A77A] font-serif-heading">
                            ₹{item.priceInr.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#F6F2EC]/65 line-clamp-2 mb-2">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-[#F6F2EC]/50">
                      <span>{item.brand || 'Bespoke'}</span>
                      <button
                        type="button"
                        onClick={() => repository.removeContentItem(item.id)}
                        className="text-[#E07A6A] hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PLAN */}
        {selectedTab === 'PLAN' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#F6F2EC]/50">
                  2D Schematic Floor Plan Architecture
                </div>
                <div className="text-xs text-[#F6F2EC]/70">
                  Interactive CAD layout with all {tourScans.length} scans. Click anywhere on canvas to adjust active scan pin.
                </div>
              </div>
              <div className="flex gap-2">
                <BrassButton
                  text="Upload Custom CAD"
                  onClick={() => setShowPlanUpload(true)}
                  icon={Upload}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DOLLHOUSE 3D */}
        {selectedTab === 'DOLLHOUSE_3D' && (
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#F6F2EC]/50">
              3D Spatial Dollhouse Configuration
            </div>
            <p className="text-xs text-[#F6F2EC]/70">
              3D geometry mesh aligned with multi-resolution camera centers. Tap any room volume in the viewport above to fly into the scene.
            </p>
          </div>
        )}

        {/* TAB 6: SETTINGS */}
        {selectedTab === 'SETTINGS' && (
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#F6F2EC]/50">
              Tour Branding & Presentation Style
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#141210] border border-white/10">
              <div>
                <div className="text-xs font-bold text-[#F6F2EC]">Custom Accent Palette</div>
                <div className="text-[11px] text-[#F6F2EC]/60">
                  Current: {tour.brandColorHex} (Warm Brass Architecture)
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#D6A77A] border-2 border-white shadow-md" />
            </div>
          </div>
        )}
      </footer>

      {/* DIALOG 1: Add Product Card Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC] mb-4">
              Add Product / Material Card
            </h3>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                  Product / Item Name
                </label>
                <input
                  type="text"
                  required
                  value={prodTitle}
                  onChange={(e) => setProdTitle(e.target.value)}
                  placeholder="e.g. Italian Teakwood 3-Seater Sofa"
                  className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                  Price in INR (₹)
                </label>
                <input
                  type="number"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  placeholder="e.g. 145000"
                  className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                    Brand / Maker
                  </label>
                  <input
                    type="text"
                    value={prodBrand}
                    onChange={(e) => setProdBrand(e.target.value)}
                    placeholder="Atelier Bespoke"
                    className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                    Dimensions
                  </label>
                  <input
                    type="text"
                    value={prodDims}
                    onChange={(e) => setProdDims(e.target.value)}
                    placeholder='88"W × 38"D'
                    className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                  Description & Materials
                </label>
                <textarea
                  rows={2}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Handcrafted Italian leather with Burma teak frame..."
                  className="w-full p-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] cursor-pointer"
                >
                  Cancel
                </button>
                <BrassButton type="submit" text="Save Product Card" />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG 2: Add Navigation Link Modal */}
      {showAddLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC] mb-4">
              Connect Scan Hotspot
            </h3>
            <form onSubmit={handleAddLink} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                  Destination Room / Scan
                </label>
                <select
                  value={linkTargetId}
                  onChange={(e) => {
                    setLinkTargetId(e.target.value);
                    const t = tourScans.find((s) => s.id === e.target.value);
                    if (t) setLinkLabel(`Walk to ${t.roomName}`);
                  }}
                  className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                >
                  {tourScans
                    .filter((s) => s.id !== activeScanId)
                    .map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#1B1815]">
                        {s.roomName} ({s.name})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                  Hotspot Label
                </label>
                <input
                  type="text"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="e.g. Go to Dining"
                  className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLink(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] cursor-pointer"
                >
                  Cancel
                </button>
                <BrassButton type="submit" text="Create Hotspot" />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG 3: Floor Plan Upload */}
      {showPlanUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC] mb-4">
              Upload Custom Floor Plan
            </h3>
            <form onSubmit={handlePlanUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                  Floor / Level Name
                </label>
                <input
                  type="text"
                  value={planLevel}
                  onChange={(e) => setPlanLevel(e.target.value)}
                  placeholder="Ground Floor"
                  className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                  Plan Description / Sheet Name
                </label>
                <input
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="Architectural Level Layout"
                  className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-xs text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                  File Format
                </label>
                <div className="flex gap-2">
                  {(['PNG', 'SVG', 'AutoCAD DXF'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setPlanFormat(fmt)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        planFormat === fmt
                          ? 'bg-[#D6A77A] text-[#0E0C0A] border-[#D6A77A]'
                          : 'bg-[#141210] text-[#F6F2EC]/70 border-white/10'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {planFormat === 'AutoCAD DXF' ? (
                <div className="p-3 rounded-lg bg-[#F0A060]/15 border border-[#F0A060]/35 text-[11px] text-[#F0A060] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    AutoCAD DXF/DWG format is not directly supported yet. Please export to SVG or high-resolution PNG from AutoCAD/Revit.
                  </span>
                </div>
              ) : planFormat === 'SVG' ? (
                <div className="p-3 rounded-lg bg-[#9CC0B4]/15 border border-[#9CC0B4]/35 text-[11px] text-[#9CC0B4]">
                  SVG input will be sanitized (scripts and external references removed for security).
                </div>
              ) : null}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPlanUpload(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] cursor-pointer"
                >
                  Cancel
                </button>
                <BrassButton
                  type="submit"
                  disabled={planFormat === 'AutoCAD DXF'}
                  text="Save Floor Plan"
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG 4: Import Render Package */}
      {showImportPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC] mb-2">
              Import Render Package
            </h3>
            <p className="text-xs text-[#F6F2EC]/60 mb-4">
              Controlled import pipeline with SHA-256 duplicate detection (SketchUp + V-Ray 6 packages with 3D camera coordinates).
            </p>
            <div className="p-3.5 rounded-xl bg-[#141210] border border-white/10 space-y-1 text-xs mb-4">
              <div className="font-bold text-[#F6F2EC]">
                Package: Skyline Royal Penthouse (V-Ray 6)
              </div>
              <div className="text-[#D6A77A]">Engine: SketchUp / V-Ray 6</div>
              <div className="text-[#F6F2EC]/60">3 rooms with calibrated 3D coordinates</div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportPackage(false)}
                className="px-4 py-2 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] cursor-pointer"
              >
                Cancel
              </button>
              <BrassButton text="Execute Import" onClick={handleImportSamplePackage} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
