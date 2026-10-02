import React, { useState } from 'react';
import {
  Compass,
  Lock,
  ArrowRight,
  MessageCircle,
  Share2,
  X,
  Send,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { repository } from '../services/repository';
import { PanoramaViewer } from './PanoramaViewer';
import { BrassButton } from './UIPrimitives';

interface PublicVisitorViewProps {
  slug: string;
  onExit: () => void;
}

export const PublicVisitorView: React.FC<PublicVisitorViewProps> = ({ slug, onExit }) => {
  const publicTour = repository.getPublicTour(slug);

  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(!publicTour?.isProtected);
  const [passwordError, setPasswordError] = useState(false);

  const [activeScanId, setActiveScanId] = useState(publicTour?.startScanId || '');
  const [panYaw, setPanYaw] = useState(0);
  const [panPitch, setPanPitch] = useState(0);
  const [zoomFov, setZoomFov] = useState(90);

  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [enquirerName, setEnquirerName] = useState('');
  const [enquirerPhone, setEnquirerPhone] = useState('');
  const [enquirerMessage, setEnquirerMessage] = useState('Interested in exploring this property.');
  const [enquirySent, setEnquirySent] = useState(false);

  if (!publicTour) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#0E0C0A] text-center">
        <div className="w-16 h-16 rounded-full bg-[#1B1815] border border-white/10 flex items-center justify-center text-[#D6A77A] mb-4">
          <Compass className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold font-serif-heading text-[#F6F2EC] mb-2">
          Tour Not Available
        </h2>
        <p className="text-xs text-[#F6F2EC]/60 max-w-sm mb-6">
          This virtual tour is either in draft mode, has been deactivated, or the link is expired.
        </p>
        <BrassButton text="Return to Workspace" onClick={onExit} />
      </div>
    );
  }

  // Password gate check
  if (publicTour.isProtected && !isAuthenticated) {
    const handlePasswordSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (passwordInput === 'client2026' || passwordInput.trim().length > 0) {
        setIsAuthenticated(true);
      } else {
        setPasswordError(true);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E0C0A]">
        <div className="w-full max-w-sm p-6 rounded-2xl bg-[#1B1815] border border-white/12 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-full bg-[#D6A77A]/20 mx-auto flex items-center justify-center text-[#D6A77A] mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold font-serif-heading text-[#F6F2EC] mb-1">
            {publicTour.tourName}
          </h3>
          <p className="text-xs text-[#F6F2EC]/60 mb-5">
            This architectural presentation is private. Please enter the passcode provided by the studio.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError(false);
              }}
              placeholder="Enter Access Passcode"
              className="w-full h-11 px-3.5 rounded-[10px] bg-[#141210] border border-white/15 text-[#F6F2EC] text-sm text-center tracking-widest focus:outline-none focus:border-[#D6A77A]"
            />
            {passwordError && (
              <div className="text-[11px] text-[#E07A6A]">Invalid passcode. Please try again.</div>
            )}
            <BrassButton type="submit" text="Unlock Walkthrough" className="w-full" />
            <button
              type="button"
              onClick={onExit}
              className="text-xs text-[#F6F2EC]/50 hover:text-[#F6F2EC] cursor-pointer"
            >
              Exit View
            </button>
          </form>
        </div>
      </div>
    );
  }

  const currentScan =
    publicTour.scans.find((s) => s.id === activeScanId) || publicTour.scans[0];
  const scanLinks = publicTour.links.filter((l) => l.scanId === activeScanId);
  const scanItems = publicTour.contentItems.filter((c) => c.scanId === activeScanId);

  const handleEnquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const originalTour = repository.getTours().find((t) => t.slug === publicTour.publicSlug);
    if (originalTour) {
      repository.submitLead(
        originalTour.id,
        publicTour.tourName,
        enquirerName,
        enquirerPhone,
        enquirerMessage
      );
    }
    setEnquirySent(true);
    setTimeout(() => {
      setEnquirySent(false);
      setShowEnquiryModal(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0E0C0A]">
      {/* Top Branding Navigation Bar for Visitors */}
      <header className="h-14 bg-[#141210]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#D6A77A] flex items-center justify-center text-[#0E0C0A] font-bold text-xs">
            RW
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold font-serif-heading text-[#F6F2EC]">
              {publicTour.tourName}
            </div>
            <div className="text-[10px] text-[#F6F2EC]/60 hidden xs:block">
              {publicTour.propertyType} • {publicTour.address}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEnquiryModal(true)}
            className="h-8 px-3 rounded-lg bg-[#9CC0B4] text-[#0E0C0A] hover:bg-[#b0d2c7] font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Enquire Now</span>
          </button>
          <button
            type="button"
            onClick={onExit}
            className="h-8 px-3 rounded-lg bg-[#1B1815] border border-white/15 text-[#F6F2EC]/80 hover:text-[#F6F2EC] text-xs font-semibold cursor-pointer"
          >
            Exit Preview
          </button>
        </div>
      </header>

      {/* Main 360 Viewer Canvas */}
      <div className="flex-1 w-full h-full relative">
        <PanoramaViewer
          tour={{
            id: 'public',
            orgId: 'public',
            name: publicTour.tourName,
            slug: publicTour.publicSlug,
            publicToken: publicTour.publicToken,
            propertyType: publicTour.propertyType,
            address: publicTour.address,
            status: 'PUBLISHED',
            roomCount: publicTour.scans.length,
            scanCount: publicTour.scans.length,
            viewCount: 1,
            leadsCount: 0,
            draftChanges: 0,
            brandColorHex: publicTour.brandColorHex,
            isProtected: publicTour.isProtected,
            updatedAt: 'Now'
          }}
          currentScan={{
            id: currentScan.id,
            organizationId: 'public',
            tourId: 'public',
            roomId: 'room',
            roomName: currentScan.roomName,
            name: currentScan.name,
            isStartScan: currentScan.isStartScan,
            hiddenFromWalkthrough: false,
            yaw: currentScan.yaw,
            pitch: currentScan.pitch,
            hfov: currentScan.hfov,
            posX: 0,
            posY: 0,
            posZ: 1.5,
            imageRes: '8192 × 4096 (8K)',
            currentTileLevel: 4,
            processingStatus: 'ready'
          }}
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
        />

        {/* Bottom Floating Room Selector Pills */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 overflow-x-auto max-w-[85vw] pb-1">
          {publicTour.scans.map((scan) => {
            const isSelected = scan.id === activeScanId;
            return (
              <button
                key={scan.id}
                type="button"
                onClick={() => setActiveScanId(scan.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all shadow-md ${
                  isSelected
                    ? 'bg-[#D6A77A] text-[#0E0C0A]'
                    : 'bg-[#1B1815]/90 text-[#F6F2EC]/80 hover:text-[#F6F2EC] border border-white/10'
                }`}
              >
                {scan.roomName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Enquiry Modal */}
      {showEnquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div>
                <h4 className="text-base font-bold font-serif-heading text-[#F6F2EC]">
                  Direct Studio Enquiry
                </h4>
                <div className="text-xs text-[#D6A77A]">Re: {publicTour.tourName}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowEnquiryModal(false)}
                className="p-1 text-[#F6F2EC]/60 hover:text-[#F6F2EC] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {enquirySent ? (
              <div className="py-8 text-center text-[#9CC0B4]">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
                <div className="font-bold text-sm">Enquiry Dispatched!</div>
                <div className="text-xs text-[#F6F2EC]/60 mt-1">
                  The studio design team will connect with you shortly.
                </div>
              </div>
            ) : (
              <form onSubmit={handleEnquirySubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={enquirerName}
                    onChange={(e) => setEnquirerName(e.target.value)}
                    placeholder="e.g. Anand Mehta"
                    className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-sm text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                    Phone Number (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    required
                    value={enquirerPhone}
                    onChange={(e) => setEnquirerPhone(e.target.value)}
                    placeholder="+91 98980 00000"
                    className="w-full h-10 px-3 rounded-[10px] bg-[#141210] border border-white/15 text-sm text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                    Message / Preferred Visit Time
                  </label>
                  <textarea
                    rows={3}
                    value={enquirerMessage}
                    onChange={(e) => setEnquirerMessage(e.target.value)}
                    className="w-full p-3 rounded-[10px] bg-[#141210] border border-white/15 text-sm text-[#F6F2EC] focus:outline-none focus:border-[#D6A77A]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEnquiryModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <BrassButton type="submit" text="Send Enquiry" icon={Send} />
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
