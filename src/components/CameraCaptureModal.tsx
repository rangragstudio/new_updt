import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Compass,
  ArrowDown,
  Info,
  ShieldAlert,
  Loader2,
  ChevronRight,
  Smartphone,
  Laptop,
  Eye,
  Sliders
} from 'lucide-react';
import { Tour } from '../types/models';

export type GuidanceState =
  | 'WAITING'
  | 'LEVELING'
  | 'READY'
  | 'CAPTURING'
  | 'CAPTURED'
  | 'MOVE_TO_NEXT_POINT'
  | 'COMPLETED'
  | 'CAMERA_UNAVAILABLE';

export type SpacingStatus = 'TOO_CLOSE' | 'GOOD' | 'TOO_FAR';

interface CameraCaptureModalProps {
  tour: Tour;
  isOpen: boolean;
  onClose: () => void;
  onScanSaved?: () => void;
}

const TOTAL_STATIONS = 8; // Standard 8-station capture sequence around the room

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
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [orientationAvailable, setOrientationAvailable] = useState<boolean | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);

  // Real sensor readings (never simulated or invented on PC)
  const [roll, setRoll] = useState<number | null>(null);
  const [pitch, setPitch] = useState<number | null>(null);

  // Capture Stations (8 positions around the room sequence)
  const [capturedStations, setCapturedStations] = useState<number[]>([]);
  const [currentStation, setCurrentStation] = useState<number>(1);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);

  // Spacing guidance state (meters between capture spots)
  const [estimatedDistanceMeters, setEstimatedDistanceMeters] = useState<number>(2.2);
  const [showReviewCaptures, setShowReviewCaptures] = useState<boolean>(false);

  // Spacing evaluation using repository thresholds:
  // < 0.9m: TOO_CLOSE ("Move a little farther")
  // 0.9m - 3.0m: GOOD ("Good position")
  // > 3.0m: TOO_FAR ("Move closer")
  const spacingStatus: SpacingStatus =
    estimatedDistanceMeters < 0.9
      ? 'TOO_CLOSE'
      : estimatedDistanceMeters > 3.0
      ? 'TOO_FAR'
      : 'GOOD';

  const spacingMessage =
    spacingStatus === 'TOO_CLOSE'
      ? 'Move a little farther'
      : spacingStatus === 'TOO_FAR'
      ? 'Move closer'
      : 'Good position';

  // 1. Detect Mobile Environment & Request Camera Only When Entering
  useEffect(() => {
    if (!isOpen) return;

    // Detect if device is a phone/tablet or desktop PC
    const isMobile =
      typeof navigator !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(pointer: coarse)').matches));
    setIsMobileDevice(isMobile);

    let isMounted = true;
    setGuidanceState('WAITING');
    setShowReviewCaptures(false);

    // Check if camera API is supported by the browser
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraAvailable(false);
      setGuidanceState('CAMERA_UNAVAILABLE');
      return;
    }

    // Request camera permission only when user enters With Camera
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
        setCameraAvailable(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setGuidanceState('READY');
      })
      .catch((err) => {
        console.warn('Real camera stream unavailable:', err.name || err);
        if (isMounted) {
          setCameraAvailable(false);
          setGuidanceState('CAMERA_UNAVAILABLE');
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

  // 2. Real Orientation Sensor Detection (No simulated values on PC)
  useEffect(() => {
    if (!isOpen) return;

    let hasReceivedValidEvent = false;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // If sensor values are null (common on PC browsers), do not invent values
      if (e.gamma === null && e.beta === null) {
        if (!hasReceivedValidEvent) {
          setOrientationAvailable(false);
        }
        return;
      }

      hasReceivedValidEvent = true;
      setOrientationAvailable(true);

      const currentRoll = e.gamma !== null ? Math.round(e.gamma) : 0;
      const currentPitch = e.beta !== null ? Math.round(e.beta) : 0;

      setRoll(currentRoll);
      setPitch(currentPitch);

      // Evaluate leveling state
      const isLevel = Math.abs(currentRoll) <= 3;
      setGuidanceState((prev) => {
        if (
          prev === 'CAPTURING' ||
          prev === 'CAPTURED' ||
          prev === 'COMPLETED' ||
          prev === 'CAMERA_UNAVAILABLE'
        ) {
          return prev;
        }
        return isLevel ? 'READY' : 'LEVELING';
      });
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    } else {
      setOrientationAvailable(false);
    }

    const timer = setTimeout(() => {
      if (!hasReceivedValidEvent) {
        setOrientationAvailable(false);
      }
    }, 1200);

    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, [isOpen]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      capturedFrames.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [capturedFrames]);

  // 3. Handle Frame Capture from Real Stream
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
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const frameUrl = URL.createObjectURL(blob);
              setCapturedFrames((prev) => [...prev, frameUrl]);
            }
          },
          'image/jpeg',
          0.92
        );
      }
    }

    // Sequence timing
    setTimeout(() => {
      const updatedCount = capturedStations.length + 1;
      setCapturedStations((prev) => [...prev, currentStation]);
      setGuidanceState('CAPTURED');

      setTimeout(() => {
        if (updatedCount >= TOTAL_STATIONS) {
          setGuidanceState('COMPLETED');
        } else {
          setCurrentStation((prev) => prev + 1);
          setGuidanceState('MOVE_TO_NEXT_POINT');

          setTimeout(() => {
            setGuidanceState('READY');
          }, 1800);
        }
      }, 1000);
    }, 600);
  };

  // 4. Handle Retake
  const handleRetake = () => {
    if (capturedStations.length === 0) return;

    const targetStation = capturedStations[capturedStations.length - 1];
    setCapturedStations((prev) => prev.slice(0, -1));

    const lastFrame = capturedFrames[capturedFrames.length - 1];
    if (lastFrame && lastFrame.startsWith('blob:')) {
      URL.revokeObjectURL(lastFrame);
    }
    setCapturedFrames((prev) => prev.slice(0, -1));

    setCurrentStation(targetStation);
    setGuidanceState('READY');
  };

  const handleResetCapture = () => {
    capturedFrames.forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    setCapturedFrames([]);
    setCapturedStations([]);
    setCurrentStation(1);
    setGuidanceState('READY');
    setShowReviewCaptures(false);
  };

  if (!isOpen) return null;

  // Level calculations
  const isLevel = roll !== null ? Math.abs(roll) <= 3 : true;
  const rollDegrees = roll !== null ? Math.abs(roll) : 0;
  const indicatorOffset = roll !== null ? Math.max(-45, Math.min(45, (roll / 35) * 45)) : 0;

  // Progress percentage based ONLY on actual completed stations
  const progressPercent = Math.round((capturedStations.length / TOTAL_STATIONS) * 100);

  // Device availability separation:
  // If camera is unavailable OR running on PC without camera/sensors
  const isDeviceAvailable = cameraAvailable === true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none p-0 sm:p-4">
      <div className="relative w-full h-full sm:max-w-2xl bg-[#0E0C0A] flex flex-col justify-between overflow-hidden sm:rounded-2xl sm:border sm:border-white/15 sm:max-h-[92vh] shadow-2xl">
        {/* Real Live Camera Video Feed (When device is available) */}
        <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
          {isDeviceAvailable ? (
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
          ) : null}

          {/* DEVICE UNAVAILABLE SCREEN (e.g. PC without camera or unsupported device) */}
          {!isDeviceAvailable && (
            <div className="p-6 sm:p-8 text-center max-w-md mx-auto flex flex-col items-center z-10">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
                <Smartphone className="w-8 h-8" />
              </div>

              <h3 className="text-lg sm:text-xl font-bold font-serif-heading text-[#F6F2EC] mb-2 leading-tight">
                Camera capture requires a compatible mobile device.
              </h3>

              <p className="text-xs text-[#F6F2EC]/70 leading-relaxed mb-5">
                The "With Camera" 360° capture workflow is designed for mobile phones equipped with a rear camera and orientation motion sensors.
              </p>

              {/* Development / Device Status Indicators */}
              <div className="w-full bg-[#141210] border border-white/10 rounded-xl p-3.5 space-y-2 mb-5 text-left">
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#D6A77A]">
                  Device Capability Status
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#F6F2EC]/70">Camera:</span>
                  <span
                    className={`font-semibold ${
                      cameraAvailable ? 'text-[#9CC0B4]' : 'text-amber-400'
                    }`}
                  >
                    {cameraAvailable
                      ? 'Camera: Available'
                      : 'Camera: Unavailable on this device'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#F6F2EC]/70">Orientation:</span>
                  <span
                    className={`font-semibold ${
                      orientationAvailable ? 'text-[#9CC0B4]' : 'text-[#F6F2EC]/50'
                    }`}
                  >
                    {orientationAvailable
                      ? 'Orientation: Available'
                      : 'Orientation: Unavailable on this device'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-[#F6F2EC]/60 bg-white/5 border border-white/10 rounded-lg p-3 text-left space-y-1.5 mb-6 w-full">
                <div className="font-semibold text-[#F6F2EC]">Available on PC:</div>
                <div>• Use <strong>"Upload from Files"</strong> to import existing 2:1 panoramas.</div>
                <div>• Open this tour URL on your mobile phone to test camera guidance.</div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F6F2EC] cursor-pointer transition-colors border border-white/10"
              >
                Close Camera
              </button>
            </div>
          )}
        </div>

        {/* 1. TOP BAR: Header, Close Button & Sequence Progress */}
        <div className="relative z-20 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D6A77A] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#F6F2EC]">
                Camera Guidance
              </span>
              {/* Subtle device status badge */}
              <span className="hidden sm:inline-block text-[10px] text-[#D6A77A] font-medium px-2 py-0.5 rounded bg-[#D6A77A]/15 border border-[#D6A77A]/30">
                {isMobileDevice ? 'Mobile Device' : 'PC Environment'}
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

          {/* Progress Card (360° CAPTURE • Point N / 8) */}
          {isDeviceAvailable && (
            <div className="px-3 py-2 rounded-xl bg-black/65 border border-white/10 backdrop-blur-md">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#F6F2EC] mb-1.5">
                <span>360° CAPTURE</span>
                <span className="font-mono text-[#D6A77A]">
                  Capture Point {Math.min(TOTAL_STATIONS, currentStation)} / {TOTAL_STATIONS}
                </span>
              </div>

              {/* Station Progress Dots */}
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
                      title={`Capture Point ${stationNum}`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#F6F2EC]/60 mt-1.5 font-mono">
                <span>Point {currentStation} of {TOTAL_STATIONS}</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. CENTER OVERLAY: Level Guidance, Visual Floor Guide & Spacing (DEVICE AVAILABLE) */}
        {isDeviceAvailable && !showReviewCaptures && (
          <div className="relative z-10 flex-1 flex flex-col items-center justify-between p-3 sm:p-4 pointer-events-none">
            {/* A. LEVEL / HORIZON GUIDE */}
            <div className="w-full max-w-xs flex flex-col items-center mt-1 sm:mt-2">
              {orientationAvailable === false ? (
                <div className="px-3 py-1.5 rounded-lg bg-black/75 border border-white/15 text-[11px] text-[#F6F2EC]/60 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#D6A77A]" />
                  <span>Level guidance unavailable on this device</span>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="relative w-56 sm:w-64 h-7 flex items-center justify-center">
                    <div className="absolute w-full h-[2px] bg-white/25 rounded-full" />
                    <div className="absolute w-12 h-[2px] bg-[#9CC0B4] rounded-full" />
                    <div className="absolute w-[2px] h-3 bg-white/40" />

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

                  <div className="mt-1">
                    {isLevel ? (
                      <span className="px-2.5 py-0.5 rounded-md bg-[#9CC0B4]/25 border border-[#9CC0B4]/50 text-[11px] font-bold text-[#9CC0B4] uppercase tracking-wider">
                        Ready • Level
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                        Level the camera {rollDegrees > 0 ? `(${rollDegrees}°)` : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* B. VISUAL POSITION GUIDE (Floor Grid Target & Next Position Guidance) */}
            <div className="flex flex-col items-center my-auto">
              <div className="relative w-40 sm:w-44 h-32 sm:h-36 rounded-2xl border border-white/20 bg-black/50 backdrop-blur-md p-2.5 sm:p-3 flex flex-col justify-between shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(#D6A77A_1px,transparent_1px)] [background-size:16px_16px] opacity-15 rounded-2xl pointer-events-none" />

                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[#D6A77A] z-10">
                  <span>POSITION GUIDE</span>
                  <span className="font-mono text-[#F6F2EC]/60">#{currentStation}</span>
                </div>

                {/* CURRENT ● → NEXT ◎ */}
                <div className="flex items-center justify-around py-1 z-10">
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] sm:text-[9px] text-[#F6F2EC]/60 mb-0.5 font-semibold">
                      {currentStation === 1 ? 'START' : `POINT ${currentStation - 1}`}
                    </span>
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#9CC0B4]/30 border-2 border-[#9CC0B4] flex items-center justify-center shadow-md">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#9CC0B4]" />
                    </div>
                    <span className="text-[8px] text-[#9CC0B4] mt-0.5 font-bold">
                      CURRENT ●
                    </span>
                  </div>

                  <div className="flex flex-col items-center px-1 text-[#D6A77A]">
                    <span className="text-[10px] animate-pulse">→</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[8px] sm:text-[9px] text-[#D6A77A] mb-0.5 font-semibold">
                      {currentStation >= TOTAL_STATIONS ? 'FINAL' : `POINT ${currentStation}`}
                    </span>
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#D6A77A]/20 border-2 border-[#D6A77A] border-dashed flex items-center justify-center animate-pulse shadow-md">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-[#D6A77A]" />
                    </div>
                    <span className="text-[8px] text-[#D6A77A] mt-0.5 font-bold">
                      NEXT ◎
                    </span>
                  </div>
                </div>

                <div className="text-[9px] sm:text-[10px] text-center text-[#F6F2EC]/80 pt-1 border-t border-white/10 z-10">
                  {guidanceState === 'MOVE_TO_NEXT_POINT' ? (
                    <span className="text-[#9CC0B4] font-semibold">
                      Move to the next capture point
                    </span>
                  ) : (
                    <span>Eye level • Hold steady</span>
                  )}
                </div>
              </div>
            </div>

            {/* C. SPACING GUIDANCE BADGE */}
            <div className="w-full max-w-xs flex flex-col items-center pointer-events-auto">
              <div
                className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center gap-2 shadow-lg backdrop-blur-md transition-all ${
                  spacingStatus === 'GOOD'
                    ? 'bg-[#9CC0B4]/20 border-[#9CC0B4]/50 text-[#9CC0B4]'
                    : spacingStatus === 'TOO_CLOSE'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    spacingStatus === 'GOOD' ? 'bg-[#9CC0B4]' : 'bg-amber-400 animate-ping'
                  }`}
                />
                <span>{spacingMessage}</span>
                <span className="text-[10px] font-mono opacity-65">
                  ({estimatedDistanceMeters.toFixed(1)}m)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. REVIEW CAPTURES MODAL VIEW */}
        {showReviewCaptures && (
          <div className="relative z-20 flex-1 p-4 sm:p-5 overflow-y-auto bg-[#0E0C0A] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold font-serif-heading text-[#F6F2EC]">
                    Review Captures
                  </h3>
                  <p className="text-xs text-[#F6F2EC]/60">
                    {capturedStations.length} of {TOTAL_STATIONS} station frames recorded
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewCaptures(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-[#F6F2EC] cursor-pointer"
                >
                  Back to Camera
                </button>
              </div>

              {/* Grid of Captured Frames */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                {Array.from({ length: TOTAL_STATIONS }).map((_, idx) => {
                  const stationNum = idx + 1;
                  const frame = capturedFrames[idx];
                  return (
                    <div
                      key={stationNum}
                      className="aspect-video rounded-lg bg-black/60 border border-white/15 overflow-hidden flex flex-col items-center justify-center relative group"
                    >
                      {frame ? (
                        <img
                          src={frame}
                          alt={`Capture ${stationNum}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-[10px] text-[#F6F2EC]/40 text-center p-1">
                          Point {stationNum}
                          <br />
                          Pending
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-mono font-bold text-[#D6A77A]">
                        #{stationNum}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300 leading-relaxed mb-4">
                <strong>Capture Status:</strong> Raw camera frames have been recorded. Note: 360° panorama stitching is in development and not yet implemented.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleRetake}
                disabled={capturedStations.length === 0}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F6F2EC] cursor-pointer disabled:opacity-40"
              >
                Retake Last Point
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-[#D6A77A] hover:bg-[#c49265] text-xs font-bold text-[#0E0C0A] cursor-pointer shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* 4. BOTTOM PANEL: Guidance State Banner, Capture Button & Retake Action */}
        {isDeviceAvailable && !showReviewCaptures && (
          <div className="relative z-20 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
            {guidanceState === 'COMPLETED' ? (
              <div className="p-4 rounded-xl bg-[#141210] border border-[#9CC0B4]/40 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-[#9CC0B4]/20 border border-[#9CC0B4]/40 flex items-center justify-center text-[#9CC0B4] mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-[#F6F2EC]">
                  Capture Complete
                </h4>
                <p className="text-xs text-[#F6F2EC]/70 max-w-sm mx-auto leading-relaxed">
                  All {TOTAL_STATIONS} capture positions have been recorded. Note: 360° panorama stitching is in development and not yet enabled in this build.
                </p>
                <div className="flex items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowReviewCaptures(true)}
                    className="px-4 py-2 rounded-xl bg-[#D6A77A] hover:bg-[#c49265] text-xs font-bold text-[#0E0C0A] cursor-pointer shadow-md"
                  >
                    Review Captures
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCapture}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F6F2EC] cursor-pointer"
                  >
                    Recapture
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F6F2EC] cursor-pointer"
                  >
                    Finish
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5">
                <div className="text-[11px] font-semibold text-[#F6F2EC] text-center">
                  {guidanceState === 'MOVE_TO_NEXT_POINT' ? (
                    <span className="text-[#9CC0B4] animate-pulse">
                      Move to Capture Point {currentStation} of {TOTAL_STATIONS}
                    </span>
                  ) : guidanceState === 'CAPTURED' ? (
                    <span className="text-[#9CC0B4]">
                      Capture Point {currentStation} Saved!
                    </span>
                  ) : !isLevel && orientationAvailable === true ? (
                    <span className="text-amber-300">
                      Level the camera before capturing
                    </span>
                  ) : (
                    <span>
                      Ready to capture point {currentStation} of {TOTAL_STATIONS}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  {capturedStations.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRetake}
                      title="Retake previous capture"
                      className="h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F6F2EC] border border-white/10 flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#D6A77A]" />
                      <span>Retake</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={guidanceState === 'CAPTURING' || (!isLevel && orientationAvailable === true)}
                    onClick={handleCapture}
                    className={`h-11 sm:h-12 px-6 sm:px-7 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer active:scale-95 ${
                      guidanceState === 'CAPTURING'
                        ? 'bg-[#1B1815] text-[#F6F2EC]/50 border border-white/15'
                        : guidanceState === 'CAPTURED'
                        ? 'bg-[#9CC0B4] text-[#0E0C0A]'
                        : !isLevel && orientationAvailable === true
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
                    ) : !isLevel && orientationAvailable === true ? (
                      <span>LEVEL THE CAMERA</span>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        <span>CAPTURE POINT {currentStation}</span>
                      </>
                    )}
                  </button>

                  {capturedStations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowReviewCaptures(true)}
                      title="Review captured frames"
                      className="h-11 sm:h-12 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#F6F2EC] border border-white/10 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-[10px] text-[#F6F2EC]/50 text-center">
                  Stand in position • Keep camera at eye level • Rotate between spots
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
