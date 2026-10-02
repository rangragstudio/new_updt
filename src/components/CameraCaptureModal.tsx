import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  Compass,
  ArrowDown,
  Info,
  ShieldAlert,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Tour } from '../types/models';
import { GlassPanel } from './UIPrimitives';

export type GuidanceState =
  | 'WAITING'
  | 'LEVELING'
  | 'READY'
  | 'CAPTURING'
  | 'CAPTURED'
  | 'MOVE_TO_NEXT_POINT'
  | 'COMPLETED'
  | 'CAMERA_UNAVAILABLE';

interface CameraCaptureModalProps {
  tour: Tour;
  isOpen: boolean;
  onClose: () => void;
  onScanSaved?: () => void;
}

const TOTAL_STATIONS = 8; // Standard 8-station 360° horizontal rotation (every 45°)

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  tour,
  isOpen,
  onClose,
  onScanSaved
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Guidance & Camera State
  const [guidanceState, setGuidanceState] = useState<GuidanceState>('WAITING');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);

  // Real sensor readings (never simulated or invented)
  const [roll, setRoll] = useState<number | null>(null);
  const [pitch, setPitch] = useState<number | null>(null);

  // Capture Stations (8 positions around 360°)
  const [capturedStations, setCapturedStations] = useState<number[]>([]);
  const [currentStation, setCurrentStation] = useState<number>(1);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);

  // 1. Initialize Real Camera Stream
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setGuidanceState('WAITING');
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setGuidanceState('CAMERA_UNAVAILABLE');
      setCameraError('Camera access is unavailable on this device.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      })
      .then((stream) => {
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setGuidanceState('READY');
      })
      .catch((err) => {
        console.error('Camera stream access failed:', err);
        if (isMounted) {
          setGuidanceState('CAMERA_UNAVAILABLE');
          setCameraError('Camera access is unavailable on this device.');
        }
      });

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  // 2. Real Device Orientation Listener (Level / Horizon Guidance)
  useEffect(() => {
    if (!isOpen) return;

    let hasReceivedValidEvent = false;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null && e.beta === null) {
        if (!hasReceivedValidEvent) {
          setSensorAvailable(false);
        }
        return;
      }

      hasReceivedValidEvent = true;
      setSensorAvailable(true);

      // Gamma = device roll (left-to-right tilt in degrees: -90 to 90)
      // Beta = device pitch (front-to-back tilt in degrees: -180 to 180)
      const currentRoll = e.gamma !== null ? Math.round(e.gamma) : 0;
      const currentPitch = e.beta !== null ? Math.round(e.beta) : 0;

      setRoll(currentRoll);
      setPitch(currentPitch);

      // Evaluate leveling state if we are not actively capturing or finished
      const isLevel = Math.abs(currentRoll) <= 3;
      setGuidanceState((prev) => {
        if (prev === 'CAPTURING' || prev === 'CAPTURED' || prev === 'COMPLETED' || prev === 'CAMERA_UNAVAILABLE') {
          return prev;
        }
        return isLevel ? 'READY' : 'LEVELING';
      });
    };

    // Check for DeviceOrientationEvent support
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    } else {
      setSensorAvailable(false);
    }

    // Safety timeout: if no orientation events are fired after 1.5 seconds, mark unavailable
    const timer = setTimeout(() => {
      if (!hasReceivedValidEvent) {
        setSensorAvailable(false);
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, [isOpen]);

  // Clean up object URLs on modal close
  useEffect(() => {
    return () => {
      capturedFrames.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [capturedFrames]);

  // Handle Capture Action
  const handleCapture = () => {
    if (guidanceState === 'CAPTURING' || guidanceState === 'CAMERA_UNAVAILABLE') return;

    setGuidanceState('CAPTURING');

    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const frameUrl = URL.createObjectURL(blob);
            setCapturedFrames((prev) => [...prev, frameUrl]);
          }
        }, 'image/jpeg', 0.92);
      }
    }

    // Capture timing feedback
    setTimeout(() => {
      const nextCount = capturedStations.length + 1;
      setCapturedStations((prev) => [...prev, currentStation]);
      setGuidanceState('CAPTURED');

      setTimeout(() => {
        if (nextCount >= TOTAL_STATIONS) {
          setGuidanceState('COMPLETED');
        } else {
          setCurrentStation((prev) => prev + 1);
          setGuidanceState('MOVE_TO_NEXT_POINT');
          setTimeout(() => {
            setGuidanceState('READY');
          }, 2000);
        }
      }, 900);
    }, 600);
  };

  const handleResetCapture = () => {
    capturedFrames.forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    setCapturedFrames([]);
    setCapturedStations([]);
    setCurrentStation(1);
    setGuidanceState('READY');
  };

  if (!isOpen) return null;

  // Level calculations
  const isLevel = roll !== null ? Math.abs(roll) <= 3 : true;
  const rollDegrees = roll !== null ? Math.abs(roll) : 0;
  // Indicator offset in percentage: -45% to +45% based on roll (-45° to +45°)
  const indicatorOffset = roll !== null ? Math.max(-45, Math.min(45, (roll / 35) * 45)) : 0;

  // Progress percentage based ONLY on actual completed stations
  const progressPercent = Math.round((capturedStations.length / TOTAL_STATIONS) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none">
      <div className="relative w-full h-full max-w-2xl bg-[#0E0C0A] flex flex-col justify-between overflow-hidden sm:rounded-2xl sm:border sm:border-white/15 sm:max-h-[92vh] shadow-2xl">
        {/* Real Live Camera Video Feed */}
        <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
          {guidanceState !== 'CAMERA_UNAVAILABLE' ? (
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
          ) : null}

          {/* Camera Unavailable Notice */}
          {guidanceState === 'CAMERA_UNAVAILABLE' && (
            <div className="p-8 text-center max-w-md mx-auto flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold font-serif-heading text-[#F6F2EC] mb-2">
                Camera Access Unavailable
              </h3>
              <p className="text-xs text-[#F6F2EC]/70 leading-relaxed mb-4">
                {cameraError || 'Camera access is unavailable on this device.'}
              </p>
              <div className="text-[11px] text-[#F6F2EC]/50 bg-white/5 border border-white/10 rounded-lg p-3 text-left space-y-1 mb-6">
                <div>• Ensure camera permissions are granted in your browser.</div>
                <div>• For local 360° scans, you can also use "Upload from Files".</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F6F2EC] cursor-pointer transition-colors"
              >
                Close Camera
              </button>
            </div>
          )}
        </div>

        {/* 1. TOP BAR: Header, Close Button & Progress */}
        <div className="relative z-20 p-4 bg-gradient-to-b from-black/85 via-black/50 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D6A77A] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#F6F2EC]">
                Camera Capture Guidance
              </span>
              <span className="text-[11px] text-[#D6A77A] font-medium px-2 py-0.5 rounded bg-[#D6A77A]/15 border border-[#D6A77A]/30">
                {tour.name}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-white/15 text-[#F6F2EC]/70 hover:text-[#F6F2EC] flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 360° Capture Progress Indicator */}
          <div className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#F6F2EC] mb-1.5">
              <span>360° CAPTURE PROGRESS</span>
              <span className="font-mono text-[#D6A77A]">{progressPercent}%</span>
            </div>

            {/* Station Dots */}
            <div className="flex items-center justify-between gap-1.5">
              {Array.from({ length: TOTAL_STATIONS }).map((_, idx) => {
                const stationNum = idx + 1;
                const isDone = capturedStations.includes(stationNum);
                const isCurrent = currentStation === stationNum && !isDone;
                return (
                  <div
                    key={stationNum}
                    className={`flex-1 h-2 rounded-full transition-all ${
                      isDone
                        ? 'bg-[#9CC0B4]'
                        : isCurrent
                        ? 'bg-[#D6A77A] animate-pulse ring-2 ring-[#D6A77A]/50'
                        : 'bg-white/20'
                    }`}
                    title={`Station ${stationNum}`}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#F6F2EC]/60 mt-1.5 font-mono">
              <span>Station {currentStation} of {TOTAL_STATIONS}</span>
              <span>{capturedStations.length} of {TOTAL_STATIONS} recorded</span>
            </div>
          </div>
        </div>

        {/* 2. CENTER OVERLAY: Level / Horizon Guide & Capture Target */}
        {guidanceState !== 'CAMERA_UNAVAILABLE' && (
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 pointer-events-none">
            {/* A. LEVEL / HORIZON GUIDE */}
            <div className="w-full max-w-xs mb-8 flex flex-col items-center">
              {sensorAvailable === false ? (
                <div className="px-3 py-1.5 rounded-lg bg-black/70 border border-white/15 text-[11px] text-[#F6F2EC]/60 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#D6A77A]" />
                  <span>Level guidance unavailable on this device</span>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  {/* Horizon Level Bar */}
                  <div className="relative w-64 h-8 flex items-center justify-center">
                    {/* Fixed Reference Line */}
                    <div className="absolute w-full h-[2px] bg-white/25 rounded-full" />
                    <div className="absolute w-12 h-[2px] bg-[#9CC0B4] rounded-full" />

                    {/* Centered Target Notch */}
                    <div className="absolute w-[2px] h-3 bg-white/40" />

                    {/* Dynamic Moving Bubble Indicator */}
                    <div
                      style={{
                        transform: `translateX(${indicatorOffset * 2.2}px)`
                      }}
                      className={`relative z-10 w-5 h-5 rounded-full border-2 transition-all duration-100 flex items-center justify-center shadow-lg ${
                        isLevel
                          ? 'bg-[#9CC0B4] border-white shadow-[#9CC0B4]/50'
                          : 'bg-amber-400 border-white shadow-amber-400/50'
                      }`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
                    </div>
                  </div>

                  {/* Level Status Text */}
                  <div className="mt-1">
                    {isLevel ? (
                      <span className="px-2.5 py-0.5 rounded-md bg-[#9CC0B4]/25 border border-[#9CC0B4]/50 text-[11px] font-bold text-[#9CC0B4] uppercase tracking-wider">
                        LEVEL
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                        LEVEL THE CAMERA {rollDegrees > 0 ? `(${rollDegrees}°)` : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* B. CAPTURE POINT / POSITION TARGET */}
            <div className="flex flex-col items-center">
              <div className="relative w-28 h-28 rounded-2xl border-2 border-dashed border-[#D6A77A]/60 flex items-center justify-center bg-black/30 backdrop-blur-xs">
                {/* Center Position Ring */}
                <div className="w-10 h-10 rounded-full border-2 border-[#D6A77A] flex items-center justify-center bg-[#D6A77A]/15 animate-pulse">
                  <div className="w-3 h-3 rounded-full bg-[#D6A77A]" />
                </div>

                {/* Target Subtitle */}
                <span className="absolute -top-3 px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[9px] font-bold text-[#D6A77A] tracking-wider uppercase">
                  CAMERA POSITION
                </span>
                <span className="absolute -bottom-3 px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[9px] font-mono text-[#F6F2EC]/80">
                  SPOT #{currentStation}
                </span>
              </div>

              {/* Guidance Tips */}
              <div className="mt-4 px-3 py-1.5 rounded-lg bg-black/75 border border-white/15 text-[11px] text-[#F6F2EC]/80 text-center max-w-xs shadow-md">
                {guidanceState === 'MOVE_TO_NEXT_POINT' ? (
                  <span className="text-[#9CC0B4] font-semibold">
                    Turn approx 45° to the next capture position
                  </span>
                ) : (
                  <span>
                    Keep camera at approximately eye level • Hold steady
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. BOTTOM PANEL: Guidance State Banner, Capture Button & Spacing */}
        <div className="relative z-20 p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
          {guidanceState === 'COMPLETED' ? (
            <div className="p-4 rounded-xl bg-[#141210] border border-[#9CC0B4]/40 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#9CC0B4]/20 border border-[#9CC0B4]/40 flex items-center justify-center text-[#9CC0B4] mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#F6F2EC]">
                All {TOTAL_STATIONS} Positions Recorded
              </h4>
              <p className="text-xs text-[#F6F2EC]/70 max-w-sm mx-auto leading-relaxed">
                Raw station frames have been captured. Note: 360° panorama stitching is in development and not yet enabled in this build.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetCapture}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F6F2EC] cursor-pointer"
                >
                  Recapture
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-[#D6A77A] hover:bg-[#c49265] text-xs font-bold text-[#0E0C0A] cursor-pointer shadow-md"
                >
                  Finish
                </button>
              </div>
            </div>
          ) : guidanceState !== 'CAMERA_UNAVAILABLE' ? (
            <div className="flex flex-col items-center gap-3">
              {/* Capture Spacing Reference */}
              <div className="flex items-center gap-3 text-[10px] text-[#F6F2EC]/60 font-mono bg-black/60 px-3 py-1 rounded-full border border-white/10">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#9CC0B4]" />
                  Spot {Math.max(1, currentStation - 1)} (Previous)
                </span>
                <ChevronRight className="w-3 h-3 text-[#D6A77A]" />
                <span className="flex items-center gap-1 text-[#D6A77A] font-semibold">
                  <span className="w-2 h-2 rounded-full border border-[#D6A77A]" />
                  Spot {currentStation} (Current)
                </span>
              </div>

              {/* Primary Capture Button */}
              <button
                type="button"
                disabled={guidanceState === 'CAPTURING' || (!isLevel && sensorAvailable === true)}
                onClick={handleCapture}
                className={`w-48 h-12 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer active:scale-95 ${
                  guidanceState === 'CAPTURING'
                    ? 'bg-[#1B1815] text-[#F6F2EC]/50 border border-white/15'
                    : guidanceState === 'CAPTURED'
                    ? 'bg-[#9CC0B4] text-[#0E0C0A]'
                    : !isLevel && sensorAvailable === true
                    ? 'bg-[#1B1815] text-amber-300 border border-amber-500/30'
                    : 'bg-[#D6A77A] hover:bg-[#c49265] text-[#0E0C0A]'
                }`}
              >
                {guidanceState === 'CAPTURING' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#D6A77A]" />
                    <span>CAPTURING...</span>
                  </>
                ) : guidanceState === 'CAPTURED' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>CAPTURED</span>
                  </>
                ) : !isLevel && sensorAvailable === true ? (
                  <span>LEVEL THE CAMERA</span>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>READY • CAPTURE</span>
                  </>
                )}
              </button>

              <div className="text-[10px] text-[#F6F2EC]/50 text-center">
                Rotate 45° after each capture to complete the 360° scan
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
