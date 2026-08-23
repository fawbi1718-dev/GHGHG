import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  Camera, Flashlight, RefreshCw, X, Sparkles, 
  Maximize2, RotateCcw, ShieldAlert, Tag
} from 'lucide-react';
import { HardwareIntegrationService } from '../../infrastructure/hardware/HardwareIntegrationService';
import { Medicine } from '../../types';

interface InlineCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onExpandToModal?: () => void;
  medicines?: Medicine[];
  lang?: 'en' | 'ar';
}

export default function InlineCameraScanner({
  isOpen,
  onClose,
  onScan,
  onExpandToModal,
  medicines = [],
  lang = 'ar'
}: InlineCameraScannerProps) {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [isCameraLive, setIsCameraLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastMatchedMed, setLastMatchedMed] = useState<Medicine | null>(null);
  const [isDetected, setIsDetected] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const lastTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const isMountedRef = useRef(false);

  const onScanRef = useRef(onScan);
  const medicinesRef = useRef(medicines);
  useEffect(() => {
    onScanRef.current = onScan;
    medicinesRef.current = medicines;
  });

  const handleBarcodeFound = useCallback((rawCode: string) => {
    const code = String(rawCode || '').trim().replace(/,$/, '');
    if (!code || isProcessingRef.current) return;

    const now = Date.now();
    if (lastTimeRef.current.code === code && now - lastTimeRef.current.time < 1500) {
      return;
    }

    isProcessingRef.current = true;
    lastTimeRef.current = { code, time: now };
    setLastScannedCode(code);
    setIsDetected(true);

    // Find medicine in catalog
    const target = code.toLowerCase();
    const matched = (medicinesRef.current || []).find(m => {
      const b = String(m.barcode || '').trim().toLowerCase();
      const id = String(m.id || '').trim().toLowerCase();
      const batch = String(m.batchNumber || '').trim().toLowerCase();
      return b === target || id === target || batch === target;
    }) || null;

    setLastMatchedMed(matched);

    // Audio & haptic feedback
    HardwareIntegrationService.getInstance().playScanSuccess();

    // Trigger parent callback
    onScanRef.current(code);

    setTimeout(() => {
      if (isMountedRef.current) {
        setIsDetected(false);
        isProcessingRef.current = false;
      }
    }, 1500);
  }, []);

  const stopCamera = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraLive(false);
    setTorchOn(false);
    setHasTorchSupport(false);
  }, []);

  const startCamera = useCallback(async (currentFacing: 'environment' | 'user') => {
    stopCamera();
    setError(null);
    isProcessingRef.current = false;

    const isSecure = window.isSecureContext || 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';

    if (!isSecure && window.location.protocol !== 'https:') {
      setError(lang === 'ar' ? 'يتطلب تشغيل الكاميرا اتصالاً آمناً HTTPS' : 'Camera access requires HTTPS or localhost');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(lang === 'ar' ? 'المتصفح لا يدعم الوصول للكاميرا' : 'Browser does not support camera media stream');
      return;
    }

    try {
      let stream: MediaStream;
      try {
        // Try ideal constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: currentFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (e) {
        // Fallback to generic video
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      if (!isMountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play error:', playErr);
        }
      }

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      if (track && (track as any).getCapabilities) {
        const caps = (track as any).getCapabilities();
        setHasTorchSupport(Boolean((caps as any).torch));
      }

      setIsCameraLive(true);

      // Detection Loop Setup
      const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window && typeof (window as any).BarcodeDetector === 'function';
      let detector: any = null;
      if (hasBarcodeDetector) {
        try {
          detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'data_matrix']
          });
        } catch (e) {
          detector = null;
        }
      }

      // Frame scan loop
      let lastScanTick = 0;
      const scanLoop = async (now: number) => {
        if (!isMountedRef.current || !videoRef.current || !streamRef.current) return;

        if (
          now - lastScanTick > 80 && // ~12 fps scan rate for optimum CPU/battery
          videoRef.current.readyState >= 2 && 
          !isProcessingRef.current && 
          videoRef.current.videoWidth > 0
        ) {
          lastScanTick = now;
          if (detector) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
                handleBarcodeFound(barcodes[0].rawValue);
              }
            } catch (e) {}
          }
        }

        rafIdRef.current = requestAnimationFrame(scanLoop);
      };

      rafIdRef.current = requestAnimationFrame(scanLoop);

    } catch (err: any) {
      console.warn('Inline camera access error:', err);
      if (!isMountedRef.current) return;
      setError(lang === 'ar' ? 'تعذر تشغيل الكاميرا. يرجى التحقق من أذونات المتصفح' : 'Unable to access camera. Please check permissions.');
    }
  }, [stopCamera, handleBarcodeFound, lang]);

  useEffect(() => {
    isMountedRef.current = true;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera();
      } else if (isOpen && isMountedRef.current) {
        startCamera(facingMode);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (isOpen) {
      const timer = setTimeout(() => {
        if (isMountedRef.current && !document.hidden) {
          startCamera(facingMode);
        }
      }, 50);
      return () => {
        clearTimeout(timer);
        stopCamera();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      stopCamera();
    }
    return () => {
      isMountedRef.current = false;
      stopCamera();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, facingMode, startCamera, stopCamera]);

  const toggleTorch = async () => {
    if (!hasTorchSupport || !streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await (track as any).applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (e) {}
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="w-full bg-slate-950 border-2 border-brand-500/80 rounded-lg overflow-hidden shadow-2xl mt-2 transition-all select-none"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      id="inline-pos-camera-scanner"
    >
      {/* Top Header Bar */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-500/20 text-brand-400">
            <Camera className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            {lang === 'ar' ? 'ماسح الكاميرا المباشر للبيع' : 'Live POS Camera Scanner'}
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping inline-block" />
          </span>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-1.5">
          {hasTorchSupport && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                torchOn 
                  ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title={lang === 'ar' ? 'الفلاش' : 'Torch'}
            >
              <Flashlight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={flipCamera}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            title={lang === 'ar' ? 'تبديل الكاميرا' : 'Switch Camera'}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {onExpandToModal && (
            <button
              type="button"
              onClick={onExpandToModal}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
              title={lang === 'ar' ? 'تكبير لشاشة كاملة' : 'Fullscreen Modal'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg transition-all cursor-pointer ml-1"
            title={lang === 'ar' ? 'إغلاق الماسح' : 'Close Scanner'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Camera Live Viewport Area */}
      <div className="relative h-64 sm:h-72 w-full bg-black overflow-hidden flex items-center justify-center">
        {/* Direct Hardware Video Element */}
        <video 
          ref={videoRef} 
          playsInline 
          muted 
          autoPlay 
          className="w-full h-full object-cover"
        />

        {/* Hidden Canvas for Frame Processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Target Reticle Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4 z-20">
          <div className={`relative w-56 h-40 sm:w-64 sm:h-44 rounded-lg transition-all duration-300 ${
            isDetected 
              ? 'border-2 border-brand-400 bg-brand-500/20 ring-4 ring-brand-500/40' 
              : 'border-2 border-brand-400/80 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
          }`}>
            <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-3 border-l-3 border-brand-400 rounded-tl-lg" />
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-3 border-r-3 border-brand-400 rounded-tr-lg" />
            <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-3 border-l-3 border-brand-400 rounded-bl-lg" />
            <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-3 border-r-3 border-brand-400 rounded-br-lg" />

            {/* Moving Laser */}
            <motion.div
              animate={{ y: [4, 145, 4] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              className="w-full h-1 bg-brand-400 shadow-[0_0_12px_#10b981] rounded-full"
            />
          </div>

          <div className="mt-3 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 shadow-md">
            <Sparkles className="w-3 h-3 text-brand-400 shrink-0" />
            <span>{lang === 'ar' ? 'وجّه رمز الباركود داخل الإطار' : 'Align barcode inside frame'}</span>
          </div>
        </div>

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center z-30 space-y-3">
            <ShieldAlert className="w-8 h-8 text-rose-400" />
            <p className="text-xs text-slate-300 max-w-xs">{error}</p>
            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Scanned Feedback Footer */}
      {lastScannedCode && (
        <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="w-3.5 h-3.5 text-brand-400 shrink-0" />
            <span className="font-mono text-slate-400 truncate">#{lastScannedCode}</span>
            {lastMatchedMed ? (
              <span className="text-brand-300 font-bold truncate max-w-[200px]">
                {lastMatchedMed.name} ({Number(lastMatchedMed.price).toLocaleString()} SYP)
              </span>
            ) : (
              <span className="text-amber-300 font-medium">
                {lang === 'ar' ? 'صنف غير مسجل' : 'Unregistered code'}
              </span>
            )}
          </div>

          <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 text-[10px] font-bold shrink-0">
            {lang === 'ar' ? ' تم الإرسال للمبيعات' : ' Added to POS'}
          </span>
        </div>
      )}
    </div>
  );
}
