import React, { useState } from 'react';
import { Home, UploadCloud, X, ArrowRight, AlertCircle, Check } from 'lucide-react';
import { repository } from '../services/repository';
import { BrassButton } from './UIPrimitives';

interface CreateTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (tourId: string) => void;
}

const PROPERTY_TYPES = [
  'Luxury Residential Villa',
  'Penthouse Suite',
  'High-End Interior Apartment',
  'Architectural Commercial Office',
  'Hospitality Resort / Hotel',
  'Bespoke Furniture Showroom'
];

export const CreateTourModal: React.FC<CreateTourModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  if (!isOpen) return null;

  const [tourName, setTourName] = useState('');
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]);
  const [address, setAddress] = useState('Kalawad Road, Rajkot, Gujarat');
  const [batchCount, setBatchCount] = useState<6 | 12>(6);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const name = tourName.trim() || 'Untitled Architectural Tour';
      const newTour = repository.createTour(name, propertyType, address);

      // Add starter room scans with initial coordinates
      repository.addScanToTour(newTour.id, 'Entrance Foyer', 'Main Door View', 0, 0);
      repository.addScanToTour(newTour.id, 'Living Room', 'Seating Lounge', 2.4, 0.5);
      repository.addScanToTour(newTour.id, 'Dining Space', 'Dining Table View', 4.8, 1.2);

      onCreated(newTour.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create tour.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1B1815] border border-white/12 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#D6A77A]/20 flex items-center justify-center text-[#D6A77A]">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#D6A77A]">
                NEW SPACE
              </div>
              <h3 className="text-lg font-bold font-serif-heading text-[#F6F2EC]">
                Create Virtual Tour
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1.5">
              Tour / Project Name
            </label>
            <input
              type="text"
              required
              value={tourName}
              onChange={(e) => setTourName(e.target.value)}
              placeholder="e.g. Skyline Sky Villa"
              className="w-full h-11 px-3.5 rounded-[10px] bg-[#141210] border border-white/15 text-[#F6F2EC] text-sm focus:outline-none focus:border-[#D6A77A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1.5">
              Property Classification
            </label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full h-11 px-3.5 rounded-[10px] bg-[#141210] border border-white/15 text-[#F6F2EC] text-sm focus:outline-none focus:border-[#D6A77A]"
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type} className="bg-[#1B1815] text-[#F6F2EC]">
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#F6F2EC]/80 mb-1.5">
              Property Location / City
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Kalawad Road, Rajkot, Gujarat"
              className="w-full h-11 px-3.5 rounded-[10px] bg-[#141210] border border-white/15 text-[#F6F2EC] text-sm focus:outline-none focus:border-[#D6A77A]"
            />
          </div>

          {/* Resumable Batch Upload Simulation Area */}
          <div className="p-3.5 rounded-xl bg-[#141210] border border-white/10">
            <div className="flex items-center gap-2 text-xs font-bold text-[#F6F2EC] mb-1">
              <UploadCloud className="w-4 h-4 text-[#D6A77A]" />
              <span>BATCH 360° PANORAMA UPLOAD</span>
            </div>
            <p className="text-[11px] text-[#F6F2EC]/60 mb-3">
              Supports 2:1 equirectangular JPG/PNG/WebP or architectural render packages with depth.
            </p>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
              <span className="text-[#9CC0B4] font-medium">
                Batch Size: {batchCount} scans pre-validated (2:1 ratio)
              </span>
              <button
                type="button"
                onClick={() => setBatchCount(batchCount === 6 ? 12 : 6)}
                className="px-2.5 py-1 rounded bg-[#D6A77A]/20 text-[#D6A77A] text-[11px] font-bold hover:bg-[#D6A77A]/30 cursor-pointer"
              >
                Switch to {batchCount === 6 ? '12 Scans' : '6 Scans'}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#E07A6A]/15 border border-[#E07A6A]/30 text-[#E07A6A] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-[10px] text-xs font-semibold text-[#F6F2EC]/70 hover:text-[#F6F2EC] cursor-pointer"
            >
              Cancel
            </button>
            <BrassButton type="submit" text="Create & Open Editor" icon={ArrowRight} />
          </div>
        </form>
      </div>
    </div>
  );
};
