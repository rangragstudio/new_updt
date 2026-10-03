import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
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
  AlertCircle,
  Camera,
  Radio,
  Loader2
} from 'lucide-react';
import { useRepository } from '../hooks/useRepository';
import { Tour, Scan, Link, ContentItem } from '../types/models';
import { StatusBadge } from '../components/StatusBadge';
import { BrassButton, OutlinedBrassButton } from '../components/UIPrimitives';
import { PanoramaViewer } from '../components/PanoramaViewer';
import { FloorPlanViewer } from '../components/FloorPlanViewer';
import { DollhouseViewer } from '../components/DollhouseViewer';
import { CameraCaptureModal } from '../components/CameraCaptureModal';

export type EditorTab = 'SCANS' | 'LINKS' | 'CONTENT' | 'PLAN' | 'DOLLHOUSE_3D' | 'SETTINGS';

export interface StagedUploadFile {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  isValid: boolean;
  validationError?: string;
  roomName: string;
  scanName: string;
}

interface TourEditorScreenProps {
  tourId: string;
  onNavigateBack: () => void;
  onNavigateToLiveCapture?: () => void;
  onOpenPublishModal: (tourId: string) => void;
}

export const TourEditorScreen: React.FC<TourEditorScreenProps> = ({
  tourId,
  onNavigateBack,
  onNavigateToLiveCapture,
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
  const [zoomFov, setZoomFov] = useState(80);

  // Dialog states
  const [showAddScanModal, setShowAddScanModal] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [showPlanUpload, setShowPlanUpload] = useState(false);
  const [scanPendingDeletion, setScanPendingDeletion] = useState<Scan | null>(null);
  const [showCameraCaptureModal, setShowCameraCaptureModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Staged Upload from Files states
  const [stagedFiles, setStagedFiles] = useState<StagedUploadFile[]>([]);
  const [showUploadReviewModal, setShowUploadReviewModal] = useState(false);
  const [isValidatingFiles, setIsValidatingFiles] = useState(false);
  const activeObjectUrlsRef = useRef<Set<string>>(new Set());

  // Clean up object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      activeObjectUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      activeObjectUrlsRef.current.clear();
    };
  }, []);

  // Synchronize activeScanId when tour scans are populated
  useEffect(() => {
    if (!activeScanId && tourScans.length > 0) {
      const startScan = tourScans.find((s) => s.isStartScan) || tourScans[0];
      if (startScan) {
        setActiveScanId(startScan.id);
      }
    }
  }, [tourScans, activeScanId]);

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
  const [planFormat, setPlanFormat] = useState<'PNG' | 'SVG'>('PNG');

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

  const handleAddScanWithCamera = () => {
    setShowAddScanModal(false);
    setShowCameraCaptureModal(true);
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsValidatingFiles(true);
    setShowAddScanModal(false);
    setShowUploadReviewModal(true);

    const filesArray = Array.from(fileList);
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const supportedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const currentScanCount = tourScans.length;

    const validatedItems: StagedUploadFile[] = await Promise.all(
      filesArray.map(async (file, index) => {
        const id = `upload-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
        const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const roomIndex = currentScanCount + index + 1;
        const roomName = '';
        const scanName = '';

        // 1. Format check
        const isSupportedExt = supportedExtensions.includes(ext);
        const isSupportedMime = file.type ? supportedMimes.includes(file.type) : isSupportedExt;

        if (!isSupportedExt || !isSupportedMime) {
          return {
            id,
            file,
            previewUrl: '',
            fileName: file.name,
            fileSizeBytes: file.size,
            width: 0,
            height: 0,
            isValid: false,
            validationError: 'Unsupported format. Please upload JPG, JPEG, PNG, or WebP.',
            roomName,
            scanName
          };
        }

        // 2. File size limit (50 MB)
        const maxSizeBytes = 50 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
          return {
            id,
            file,
            previewUrl: '',
            fileName: file.name,
            fileSizeBytes: file.size,
            width: 0,
            height: 0,
            isValid: false,
            validationError: `File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
            roomName,
            scanName
          };
        }

        // 3. Create real local Object URL from the selected file
        const previewUrl = URL.createObjectURL(file);
        activeObjectUrlsRef.current.add(previewUrl);

        // 4. Validate natural dimensions and approximately 2:1 equirectangular aspect ratio
        return new Promise<StagedUploadFile>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            const ratio = width / height;

            const isEquirectangular = (ratio >= 1.85 && ratio <= 2.15);
            const isPerspectiveSet = filesArray.length >= 2;

            if (isEquirectangular) {
              if (width < 1024 || height < 512) {
                resolve({
                  id,
                  file,
                  previewUrl,
                  fileName: file.name,
                  fileSizeBytes: file.size,
                  width,
                  height,
                  isValid: false,
                  validationError: `Resolution too low (${width} × ${height}). Minimum 1024 × 512 required for 360° panoramas.`,
                  roomName,
                  scanName
                });
                return;
              }

              resolve({
                id,
                file,
                previewUrl,
                fileName: file.name,
                fileSizeBytes: file.size,
                width,
                height,
                isValid: true,
                roomName,
                scanName
              });
              return;
            }

            // Not equirectangular
            if (!isPerspectiveSet) {
              // Single perspective photo is insufficient
              resolve({
                id,
                file,
                previewUrl,
                fileName: file.name,
                fileSizeBytes: file.size,
                width,
                height,
                isValid: false,
                validationError: `A single perspective photo is insufficient for 360° reconstruction. Please upload at least 2 or more overlapping photos of the space.`,
                roomName,
                scanName
              });
              return;
            }

            // Multiple perspective photos (N >= 2)
            if (width < 320 || height < 240) {
              resolve({
                id,
                file,
                previewUrl,
                fileName: file.name,
                fileSizeBytes: file.size,
                width,
                height,
                isValid: false,
                validationError: `Resolution too low (${width} × ${height}). Minimum 320 × 240 required.`,
                roomName,
                scanName
              });
              return;
            }

            resolve({
              id,
              file,
              previewUrl,
              fileName: file.name,
              fileSizeBytes: file.size,
              width,
              height,
              isValid: true,
              roomName,
              scanName
            });
          };

          img.onerror = () => {
            resolve({
              id,
              file,
              previewUrl,
              fileName: file.name,
              fileSizeBytes: file.size,
              width: 0,
              height: 0,
              isValid: false,
              validationError: 'Unable to decode image file. File may be corrupt.',
              roomName,
              scanName
            });
          };

          img.src = previewUrl;
        });
      })
    );

    setStagedFiles(validatedItems);
    setIsValidatingFiles(false);

    if (e.target) {
      e.target.value = '';
    }
  };

  const handleConfirmUploads = () => {
    const validFiles = stagedFiles.filter((item) => item.isValid);
    if (validFiles.length === 0) return;

    validFiles.forEach((item, index) => {
      const posX = (tourScans.length + index + 1) * 2.2;
      const posY = (tourScans.length + index + 1) * 0.8;
      const roomIndex = tourScans.length + index + 1;
      const customerRoomName = item.roomName?.trim() || `Room ${roomIndex}`;

      repository.addUploadedScanToTour(
        tour.id,
        customerRoomName,
        customerRoomName,
        posX,
        posY,
        {
          file: item.file,
          fileUrl: item.previewUrl,
          width: item.width,
          height: item.height,
          fileSizeBytes: item.fileSizeBytes
        }
      );
    });

    // Revoke object URLs of invalid items that were not committed
    stagedFiles.forEach((item) => {
      if (!item.isValid && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        activeObjectUrlsRef.current.delete(item.previewUrl);
      }
    });

    setStagedFiles([]);
    setShowUploadReviewModal(false);
  };

  const handleCancelUploadReview = () => {
    stagedFiles.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        activeObjectUrlsRef.current.delete(item.previewUrl);
      }
    });
    setStagedFiles([]);
    setShowUploadReviewModal(false);
  };

  const handleRemoveStagedItem = (id: string) => {
    const item = stagedFiles.find((f) => f.id === id);
    if (item && item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
      activeObjectUrlsRef.current.delete(item.previewUrl);
    }
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpdateStagedItem = (
    id: string,
    field: 'roomName' | 'scanName',
    value: string
  ) => {
    setStagedFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleConfirmDeleteScan = () => {
    if (!scanPendingDeletion) return;
    const deletedId = scanPendingDeletion.id;

    if (scanPendingDeletion.fileUrl && scanPendingDeletion.fileUrl.startsWith('blob:')) {
      activeObjectUrlsRef.current.delete(scanPendingDeletion.fileUrl);
    }

    const { nextActiveScanId } = repository.deleteScan(deletedId);

    if (activeScanId === deletedId) {
      if (nextActiveScanId) {
        setActiveScanId(nextActiveScanId);
      } else {
        setActiveScanId('');
      }
    }

    setScanPendingDeletion(null);
  };

  const handlePlanUpload = (e: React.FormEvent) => {
    e.preventDefault();
    repository.addFloorPlan(tour.id, planLevel, planTitle, planFormat);
    setShowPlanUpload(false);
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

      {/* 2. TAB STRIP (6 SECTIONS) */}
      <nav className="flex items-center gap-1 px-4 lg:px-6 bg-[#1B1815] border-b border-white/10 overflow-x-auto shrink-0 py-1.5">
        {[
          { tab: 'SCANS' as EditorTab, label: `Scans (${tourScans.length})`, icon: Layers },
          { tab: 'LINKS' as EditorTab, label: `Links / Hotspots (${scanLinks.length})`, icon: Link2 },
          { tab: 'CONTENT' as EditorTab, label: 'Content / Product Cards', icon: Tag },
          { tab: 'PLAN' as EditorTab, label: 'Floor Plan', icon: MapIcon },
          { tab: 'DOLLHOUSE_3D' as EditorTab, label: '3D View', icon: BoxIcon },
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
        {tourScans.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#0E0C0A] text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#D6A77A]/10 border border-[#D6A77A]/25 flex items-center justify-center text-[#D6A77A] mb-4 shadow-xl">
              <Camera className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold font-serif-heading text-[#F6F2EC] mb-2">
              No 360° Panoramas Yet
            </h2>
            <p className="text-sm text-[#F6F2EC]/60 max-w-md mb-6 leading-relaxed">
              Every newly created tour starts with 0 scans. Add your first room panorama to begin creating the walkthrough.
            </p>
            <BrassButton
              text="ADD SCAN"
              onClick={() => setShowAddScanModal(true)}
              icon={Plus}
            />
          </div>
        ) : selectedTab === 'PLAN' ? (
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
              setPanPitch((p) => Math.max(-85, Math.min(85, p + dpitch)));
            }}
            onZoomChange={(delta) => {
              setZoomFov((f) => Math.max(40, Math.min(110, f + delta)));
            }}
            onResetView={() => {
              setPanYaw(0);
              setPanPitch(0);
              setZoomFov(80);
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
                ROOM SCANS IN TOUR ({tourScans.length})
              </span>
              <div className="flex items-center gap-2">
                <BrassButton
                  text="Add Scan"
                  onClick={() => setShowAddScanModal(true)}
                  icon={Plus}
                />
              </div>
            </div>

            {tourScans.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#141210] border border-dashed border-white/15 text-center flex flex-col items-center justify-center">
                <Layers className="w-8 h-8 text-[#D6A77A]/50 mb-2" />
                <p className="text-xs font-semibold text-[#F6F2EC] mb-1">
                  No Scans in Tour
                </p>
                <p className="text-[11px] text-[#F6F2EC]/60 mb-3">
                  This tour has 0 scans. Click "Add Scan" to add your first 360° panorama scan.
                </p>
                <BrassButton
                  text="Add Scan"
                  onClick={() => setShowAddScanModal(true)}
                  icon={Plus}
                />
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {tourScans.map((scan, index) => {
                  const isSelected = scan.id === activeScanId;
                  const primaryTitle = scan.roomName?.trim() || `Room ${index + 1}`;
                  return (
                    <div
                      key={scan.id}
                      onClick={() => setActiveScanId(scan.id)}
                      className={`min-w-[210px] p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#D6A77A]/15 border-[#D6A77A]'
                          : 'bg-[#141210] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div>
                        {scan.fileUrl ? (
                          <div className="w-full h-24 rounded-lg mb-2.5 overflow-hidden bg-black/40 border border-white/10 relative">
                            <img
                              src={scan.fileUrl}
                              alt={primaryTitle}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] text-[#F6F2EC] font-mono">
                              {scan.imageRes}
                            </span>
                          </div>
                        ) : null}

                        {/* Primary Scan Title: Room Name */}
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-sm font-bold text-[#F6F2EC] truncate"
                            title={primaryTitle}
                          >
                            {primaryTitle}
                          </span>
                          {scan.isStartScan && (
                            <span
                              title="Start Scan"
                              className="text-[#D6A77A] shrink-0 ml-1.5 flex items-center gap-1 text-[10px] font-semibold"
                            >
                              <Flag className="w-3.5 h-3.5 fill-[#D6A77A]" />
                              <span>Start</span>
                            </span>
                          )}
                        </div>

                        {/* Secondary Metadata: Original Filename */}
                        {scan.originalFile && (
                          <div
                            className="text-[10px] text-[#F6F2EC]/50 truncate mb-1.5 font-mono"
                            title={scan.originalFile.name}
                          >
                            {scan.originalFile.name} ({(scan.originalFile.size / (1024 * 1024)).toFixed(1)} MB)
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px]">
                        <span
                          className={`font-semibold capitalize ${
                            scan.processingStatus === 'ready'
                              ? 'text-[#9CC0B4]'
                              : scan.processingStatus === 'failed'
                              ? 'text-[#E07A6A]'
                              : 'text-[#F0A060]'
                          }`}
                        >
                          {scan.processingStatus === 'ready'
                            ? 'Ready'
                            : scan.processingStatus === 'failed'
                            ? 'Failed'
                            : 'Processing'}
                        </span>
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setScanPendingDeletion(scan);
                            }}
                            title="Delete scan"
                            className="hover:text-[#E07A6A] p-0.5 rounded hover:bg-white/5 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LINKS */}
        {selectedTab === 'LINKS' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#F6F2EC]/50">
                Navigation Hotspots from {currentScan?.roomName || 'Current Spot'}
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
                Product & Material Hotspots in {currentScan?.roomName || 'Current Spot'}
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
                  2D Schematic Floor Plan
                </div>
                <div className="text-xs text-[#F6F2EC]/70">
                  Interactive floor plan layout with all {tourScans.length} scans. Click anywhere on canvas to adjust active scan pin.
                </div>
              </div>
              <div className="flex gap-2">
                <BrassButton
                  text="Upload Floor Plan"
                  onClick={() => setShowPlanUpload(true)}
                  icon={Upload}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: 3D VIEW */}
        {selectedTab === 'DOLLHOUSE_3D' && (
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#F6F2EC]/50">
              3D Spatial View
            </div>
            <p className="text-xs text-[#F6F2EC]/70">
              3D spatial geometry aligned with room camera spots. Tap any room volume in the viewport above to navigate directly into the scene.
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
                  {(['PNG', 'SVG'] as const).map((fmt) => (
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

              {planFormat === 'SVG' && (
                <div className="p-3 rounded-lg bg-[#9CC0B4]/15 border border-[#9CC0B4]/35 text-[11px] text-[#9CC0B4]">
                  SVG input will be sanitized (scripts and external references removed for security).
                </div>
              )}

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
                  text="Save Floor Plan"
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SCAN MODAL: 3 Clear Choices */}
      {showAddScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC]">
                Add Scan
              </h3>
              <button
                type="button"
                onClick={() => setShowAddScanModal(false)}
                className="text-xs text-[#F6F2EC]/50 hover:text-[#F6F2EC] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#F6F2EC]/60 mb-5">
              Choose how you want to add a 360° panorama scan to this space:
            </p>

            <div className="space-y-3">
              {/* Option 1: With Camera */}
              <button
                type="button"
                onClick={handleAddScanWithCamera}
                className="w-full p-4 rounded-xl bg-[#141210] border border-white/10 hover:border-[#D6A77A]/60 transition-all text-left flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-[#D6A77A]/15 border border-[#D6A77A]/30 flex items-center justify-center shrink-0 text-[#D6A77A] group-hover:bg-[#D6A77A] group-hover:text-[#0E0C0A] transition-colors">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#F6F2EC] group-hover:text-[#D6A77A] transition-colors">
                    With Camera
                  </div>
                  <div className="text-xs text-[#F6F2EC]/60 mt-0.5">
                    For capturing a scan using the phone camera workflow.
                  </div>
                </div>
              </button>

              {/* Option 2: Live Capture */}
              <button
                type="button"
                onClick={() => {
                  setShowAddScanModal(false);
                  if (onNavigateToLiveCapture) {
                    onNavigateToLiveCapture();
                  }
                }}
                className="w-full p-4 rounded-xl bg-[#141210] border border-white/10 hover:border-[#D6A77A]/60 transition-all text-left flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-[#D6A77A]/15 border border-[#D6A77A]/30 flex items-center justify-center shrink-0 text-[#D6A77A] group-hover:bg-[#D6A77A] group-hover:text-[#0E0C0A] transition-colors">
                  <Radio className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#F6F2EC] group-hover:text-[#D6A77A] transition-colors">
                    Live Capture
                  </div>
                  <div className="text-xs text-[#F6F2EC]/60 mt-0.5">
                    For the live spatial capture workflow.
                  </div>
                </div>
              </button>

              {/* Option 3: Upload from Files */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 rounded-xl bg-[#141210] border border-white/10 hover:border-[#D6A77A]/60 transition-all text-left flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-[#D6A77A]/15 border border-[#D6A77A]/30 flex items-center justify-center shrink-0 text-[#D6A77A] group-hover:bg-[#D6A77A] group-hover:text-[#0E0C0A] transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#F6F2EC] group-hover:text-[#D6A77A] transition-colors">
                    Upload from Files
                  </div>
                  <div className="text-xs text-[#F6F2EC]/60 mt-0.5">
                    For selecting existing JPG/JPEG/PNG/WebP panorama files.
                  </div>
                </div>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFilesSelected}
            />

            <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAddScanModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VALIDATING FILES LOADER */}
      {isValidatingFiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl text-center">
            <Loader2 className="w-8 h-8 text-[#D6A77A] animate-spin mx-auto mb-3" />
            <h3 className="text-sm font-bold font-serif-heading text-[#F6F2EC] mb-1">
              Validating Selected Panoramas
            </h3>
            <p className="text-xs text-[#F6F2EC]/60">
              Checking format, 2:1 aspect ratio, and resolution...
            </p>
          </div>
        </div>
      )}

      {/* UPLOAD REVIEW MODAL */}
      {showUploadReviewModal && !isValidatingFiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC]">
                  Upload from Files Review ({stagedFiles.length})
                </h3>
                <p className="text-xs text-[#F6F2EC]/60 mt-0.5">
                  Review selected panorama images and configure room spots before adding.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelUploadReview}
                className="text-xs text-[#F6F2EC]/50 hover:text-[#F6F2EC] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              {stagedFiles.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all ${
                    item.isValid
                      ? 'bg-[#141210] border-white/10'
                      : 'bg-red-950/20 border-red-500/30'
                  }`}
                >
                  {/* Real Preview Thumbnail */}
                  <div className="w-full sm:w-44 h-24 shrink-0 rounded-lg overflow-hidden bg-black/50 border border-white/10 relative flex items-center justify-center">
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-white/40">No Preview Available</span>
                    )}
                    {item.width > 0 && (
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] text-[#F6F2EC] font-mono">
                        {(item.width / item.height).toFixed(2)}:1
                      </span>
                    )}
                  </div>

                  {/* Metadata and Editing */}
                  <div className="flex-1 min-w-0 w-full space-y-2.5">
                    {/* Filename & File Size */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-[#F6F2EC] truncate" title={item.fileName}>
                        {item.fileName}
                      </div>
                      <span className="text-[11px] text-[#F6F2EC]/60 shrink-0 font-mono">
                        {(item.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>

                    {/* Width x Height & Detected Aspect Ratio Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#F6F2EC]/80 font-mono">
                        Dimensions: {item.width > 0 ? `${item.width} × ${item.height} px` : '—'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#F6F2EC]/80 font-mono">
                        Aspect Ratio: {item.height > 0 ? `${(item.width / item.height).toFixed(2)}:1` : '—'}
                      </span>
                    </div>

                    {/* Room Name Configuration */}
                    {item.isValid ? (
                      <div className="pt-1">
                        <label className="block text-[10px] uppercase font-bold text-[#F6F2EC]/60 mb-1">
                          Room Name (Primary Scan Title)
                        </label>
                        <input
                          type="text"
                          value={item.roomName}
                          placeholder="e.g. Living Room, Master Bedroom, Dining Room"
                          onChange={(e) =>
                            handleUpdateStagedItem(item.id, 'roomName', e.target.value)
                          }
                          className="w-full h-8 px-2.5 rounded-md bg-[#1B1815] border border-white/15 text-xs text-[#F6F2EC] placeholder:text-[#F6F2EC]/30 focus:outline-none focus:border-[#D6A77A]"
                        />
                        <div className="text-[10px] text-[#F6F2EC]/40 mt-0.5">
                          Leave blank to automatically default to "Room {stagedFiles.findIndex((f) => f.id === item.id) + tourScans.length + 1}"
                        </div>
                      </div>
                    ) : null}

                    {/* Validation Status */}
                    <div className="flex items-center gap-1.5 text-xs pt-0.5">
                      {item.isValid ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#9CC0B4] shrink-0" />
                          <span className="text-[#9CC0B4] font-medium text-[11px]">
                            Valid 2:1 Equirectangular Panorama
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-[#E07A6A] shrink-0" />
                          <span className="text-[#E07A6A] font-medium text-[11px]">
                            {item.validationError}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveStagedItem(item.id)}
                    title="Remove from selection"
                    className="p-1.5 text-[#F6F2EC]/40 hover:text-[#E07A6A] rounded-lg hover:bg-white/5 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-white/10 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold text-[#D6A77A] hover:text-[#D6A77A]/80 border border-[#D6A77A]/30 rounded-lg hover:bg-[#D6A77A]/10 cursor-pointer"
                >
                  Choose Another File
                </button>
                <span className="text-[11px] text-[#F6F2EC]/50">
                  {stagedFiles.filter((f) => f.isValid).length} of {stagedFiles.length} file(s) ready
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCancelUploadReview}
                  className="px-4 py-2 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] cursor-pointer"
                >
                  Cancel
                </button>
                <BrassButton
                  text={
                    stagedFiles.filter((f) => f.isValid).length > 1
                      ? `Add ${stagedFiles.filter((f) => f.isValid).length} Scans / Continue`
                      : 'Add Scan / Continue'
                  }
                  disabled={stagedFiles.filter((f) => f.isValid).length === 0}
                  onClick={handleConfirmUploads}
                  icon={Upload}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCAN DELETION CONFIRMATION DIALOG */}
      {scanPendingDeletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[#1B1815] border border-white/15 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-[#E07A6A]">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#F6F2EC]">
                Delete this scan?
              </h3>
              <p className="text-xs text-[#F6F2EC]/70 mt-1 leading-relaxed">
                This will remove the panorama and scan from this tour.
              </p>
              <div className="mt-2.5 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-[#D6A77A] font-semibold truncate">
                {scanPendingDeletion.roomName || scanPendingDeletion.name}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setScanPendingDeletion(null)}
                className="px-4 py-2 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteScan}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#E07A6A] hover:bg-[#c96455] rounded-lg shadow-md cursor-pointer transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* GUIDED CAMERA CAPTURE EXPERIENCE MODAL */}
      <CameraCaptureModal
        tour={tour}
        isOpen={showCameraCaptureModal}
        onClose={() => setShowCameraCaptureModal(false)}
      />
    </div>
  );
};
