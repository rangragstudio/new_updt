import React, { useState } from 'react';
import {
  Globe,
  Share2,
  Code,
  Lock,
  CheckCircle,
  AlertTriangle,
  X,
  Copy,
  Check,
  QrCode
} from 'lucide-react';
import { Tour } from '../types/models';
import { repository } from '../services/repository';
import { BrassButton, OutlinedBrassButton } from './UIPrimitives';

interface PublishModalProps {
  tourId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenPublicView?: (slug: string) => void;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  tourId,
  isOpen,
  onClose,
  onOpenPublicView
}) => {
  if (!isOpen) return null;

  const tour = repository.getTour(tourId);
  if (!tour) return null;

  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);
  const [customSlug, setCustomSlug] = useState(tour.slug);
  const [isProtected, setIsProtected] = useState(tour.isProtected);
  const [copied, setCopied] = useState(false);

  const validation = repository.validateForPublishing(tour.id);
  const isPublished = tour.status === 'PUBLISHED';
  const shareUrl = `${window.location.origin}/t/${customSlug}`;
  const embedCode = `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" allow="fullscreen; vr; accelerometer; gyroscope"></iframe>`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublish = () => {
    repository.updateTour(tour.id, { slug: customSlug, isProtected });
    const [success] = repository.publishTour(tour.id);
    if (success) {
      handleCopy(shareUrl);
      onClose();
    }
  };

  const handleUnpublish = () => {
    repository.unpublishTour(tour.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                isPublished ? 'bg-[#9CC0B4]/20 text-[#9CC0B4]' : 'bg-[#D6A77A]/20 text-[#D6A77A]'
              }`}
            >
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isPublished ? 'text-[#9CC0B4]' : 'text-[#D6A77A]'
                  }`}
                >
                  PUBLISH & ACCESS
                </span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    isPublished
                      ? 'bg-[#9CC0B4]/20 text-[#9CC0B4]'
                      : 'bg-[#F0A060]/20 text-[#F0A060]'
                  }`}
                >
                  {tour.status}
                </span>
              </div>
              <h3 className="text-lg font-bold font-serif-heading text-[#F6F2EC]">
                {tour.name}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#F6F2EC]/60 hover:text-[#F6F2EC] rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pre-Flight Publishing Validation Check */}
        {!validation.isValid ? (
          <div className="p-3 mb-4 rounded-xl bg-[#F0A060]/15 border border-[#F0A060]/35 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#F0A060] mb-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Cannot Publish Tour</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[#F6F2EC]/90 text-[11px]">
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-2.5 mb-4 rounded-xl bg-[#9CC0B4]/15 border border-[#9CC0B4]/30 text-xs text-[#9CC0B4] flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Pre-flight Check Passed: All scans and views ready</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab(0)}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 0
                ? 'border-[#D6A77A] text-[#D6A77A]'
                : 'border-transparent text-[#F6F2EC]/60 hover:text-[#F6F2EC]'
            }`}
          >
            Share & QR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 1
                ? 'border-[#D6A77A] text-[#D6A77A]'
                : 'border-transparent text-[#F6F2EC]/60 hover:text-[#F6F2EC]'
            }`}
          >
            Embed Iframe
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(2)}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 2
                ? 'border-[#D6A77A] text-[#D6A77A]'
                : 'border-transparent text-[#F6F2EC]/60 hover:text-[#F6F2EC]'
            }`}
          >
            Access & Privacy
          </button>
        </div>

        {/* Tab 0: Share & QR */}
        {activeTab === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                Custom Permanent Tour Slug
              </label>
              <div className="flex items-center rounded-[10px] bg-[#141210] border border-white/15 px-3 focus-within:border-[#D6A77A]">
                <span className="text-xs text-[#F6F2EC]/40 shrink-0">renderwalk.com/t/</span>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  className="w-full h-10 px-2 bg-transparent text-sm text-[#F6F2EC] focus:outline-none"
                />
              </div>
            </div>

            {/* Stylized QR Code Graphic */}
            <div className="p-3.5 rounded-xl bg-[#141210] border border-white/10 flex items-center gap-3.5">
              <div className="w-16 h-16 bg-white rounded-lg p-1.5 flex items-center justify-center shrink-0">
                <QrCode className="w-full h-full text-[#141210]" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-[#F6F2EC]">Scan QR for Mobile Walkthrough</div>
                <div className="text-[11px] text-[#F6F2EC]/60">
                  Direct CDN streaming with zero sign-in required
                </div>
                <div className="text-[10px] font-mono text-[#D6A77A] mt-1">
                  Public Token: {tour.publicToken}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Explore the 360° virtual tour of ${tour.name}: ${shareUrl}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-10 rounded-[10px] bg-[#9CC0B4] text-[#0E0C0A] hover:bg-[#b0d2c7] font-bold text-xs inline-flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Share2 className="w-4 h-4" />
                <span>Share on WhatsApp</span>
              </a>
              {onOpenPublicView && isPublished && (
                <button
                  type="button"
                  onClick={() => onOpenPublicView(customSlug)}
                  className="h-10 px-3.5 rounded-[10px] bg-[#141210] border border-[#D6A77A] text-[#D6A77A] hover:bg-[#D6A77A]/15 font-semibold text-xs cursor-pointer"
                >
                  Preview Public
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: Embed Iframe */}
        {activeTab === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-[#F6F2EC]/70">
              Responsive HTML Iframe for Websites, Real Estate Portals & Client Dashboards:
            </p>
            <div className="p-3 rounded-xl bg-[#0F0E0C] border border-white/10 font-mono text-[11px] text-[#D6A77A] break-all">
              {embedCode}
            </div>
            <button
              type="button"
              onClick={() => handleCopy(embedCode)}
              className="w-full h-10 rounded-[10px] border border-[#D6A77A] text-[#D6A77A] hover:bg-[#D6A77A]/10 text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Iframe Embed Code'}</span>
            </button>
          </div>
        )}

        {/* Tab 2: Access & Privacy */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#141210] border border-white/10">
              <div>
                <div className="text-xs font-bold text-[#F6F2EC]">Password Gate</div>
                <div className="text-[11px] text-[#F6F2EC]/60">
                  Require visitors to enter a passcode to view tour
                </div>
              </div>
              <input
                type="checkbox"
                checked={isProtected}
                onChange={(e) => setIsProtected(e.target.checked)}
                className="w-4 h-4 accent-[#D6A77A] cursor-pointer"
              />
            </div>
            {isProtected && (
              <div>
                <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1">
                  Client Access Password
                </label>
                <div className="flex items-center rounded-[10px] bg-[#141210] border border-white/15 px-3">
                  <Lock className="w-4 h-4 text-[#D6A77A] mr-2" />
                  <input
                    type="text"
                    defaultValue="client2026"
                    className="w-full h-10 bg-transparent text-sm text-[#F6F2EC] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-5 mt-5 border-t border-white/10">
          <div>
            {isPublished && (
              <button
                type="button"
                onClick={handleUnpublish}
                className="text-xs font-semibold text-[#E07A6A] hover:underline cursor-pointer"
              >
                Unpublish Tour
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] cursor-pointer"
            >
              Close
            </button>
            <BrassButton
              disabled={!validation.isValid}
              onClick={handlePublish}
              text={isPublished ? 'Update Settings' : 'Publish Tour'}
              icon={Check}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
