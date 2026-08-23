import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Camera, Flashlight, RefreshCw, ShoppingCart, 
  CheckCircle2, AlertCircle, Search, Zap, PlusCircle,
  Building2, Package, Tag, Sparkles, Plus, Minus,
  RotateCcw, ShieldAlert, Check
} from 'lucide-react';
import { HardwareIntegrationService } from '../../infrastructure/hardware/HardwareIntegrationService';
import { ScannerMode } from './ScannerModePickerModal';

export type ScannerState = 
  | 'INITIALIZING'
  | 'REQUESTING_PERMISSION'
  | 'SCANNING'
  | 'DETECTED'
  | 'LOOKING_UP'
  | 'FOUND'
  | 'NOT_FOUND'
  | 'CAMERA_ERROR'
  | 'NO_CAMERA';

export interface CatalogItem {
  id?: string;
  barcode?: string;
  code?: string;
  name?: string;
  nameEn?: string;
  name_en?: string;
  price?: number | string;
  company?: string;
  company_name?: string;
  form?: string;
  composition?: string;
  composition_key?: string;
  uses?: string;
  dosage?: string;
  package?: string;
  quantity?: number;
  stock?: number;
  [key: string]: any;
}

export interface CentralScannerModalProps {
  isOpen: boolean;
  mode?: ScannerMode;
  onClose: () => void;
  catalogData?: CatalogItem[];
  onAddToCart?: (item: CatalogItem, quantity?: number) => void;
  onAddStockItem?: (barcode: string, item: CatalogItem | null) => void;
  onItemFound?: (item: CatalogItem) => void;
  onUnknownScanned?: (barcode: string) => void;
  lang?: 'en' | 'ar';
}

interface ScannedResult {
  code: string;
  item: CatalogItem | null;
  timestamp: number;
}

export default function CentralScannerModal({
  isOpen,
  mode = 'SELL',
  onClose,
  catalogData = [],
  onAddToCart,
  onAddStockItem,
  onItemFound,
  onUnknownScanned,
  lang = 'ar'
}: CentralScannerModalProps) {
  // Current active mode (SELL or ADD_STOCK)
  const [currentMode, setCurrentMode] = useState<ScannerMode>(mode);
  
  // Camera & Device State
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [isCameraLive, setIsCameraLive] = useState(false);
  
  // State Machine
  const [scannerState, setScannerState] = useState<ScannerState>('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Manual Barcode Input
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  // Last Result
  const [lastResult, setLastResult] = useState<ScannedResult | null>(null);
  const [scannedQuantity, setScannedQuantity] = useState<number>(1);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // DOM & Controller Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const html5ScannerRef = useRef<Html5Qrcode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastScannedTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const isMountedRef = useRef<boolean>(false);
  
  // Unique DOM ID for scanner container
  const viewportIdRef = useRef(`scanner-viewport-${Math.random().toString(36).substring(2, 9)}`);

  // Storing dynamic props in Ref to guarantee zero re-render loops
  const propsRef = useRef({
    catalogData,
    onAddToCart,
    onAddStockItem,
    onItemFound,
    onUnknownScanned,
    onClose,
    lang,
    currentMode
  });

  useEffect(() => {
    propsRef.current = {
      catalogData,
      onAddToCart,
      onAddStockItem,
      onItemFound,
      onUnknownScanned,
      onClose,
      lang,
      currentMode
    };
  });

  // Sync mode prop if it changes
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Global Keyboard Escape Handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Process a successfully decoded barcode string (stable function)
  const processDecodedBarcode = useCallback((rawCode: string) => {
    const cleanedCode = String(rawCode || '').trim().replace(/,$/, '');
    if (!cleanedCode) return;

    // 1. Check synchronous atomic lock
    if (isProcessingRef.current) return;
    
    // 2. Cooldown check for duplicate frame reads (ignore exact same code within 1.5s)
    const now = Date.now();
    if (
      lastScannedTimeRef.current.code === cleanedCode && 
      now - lastScannedTimeRef.current.time < 1500
    ) {
      return;
    }

    // Set atomic lock synchronously
    isProcessingRef.current = true;
    lastScannedTimeRef.current = { code: cleanedCode, time: now };

    setScannerState('DETECTED');

    // 3. Audio & Haptic Feedback
    HardwareIntegrationService.getInstance().playScanSuccess();

    setTimeout(() => {
      if (!isMountedRef.current) return;
      setScannerState('LOOKING_UP');

      const { catalogData: currentCatalog, currentMode: activeMode, onAddToCart: addToCart, onItemFound: itemFound, onAddStockItem: addStock, onUnknownScanned: unknownScanned, lang: currentLang, onClose: closeModal } = propsRef.current;

      // 4. Lookup in Catalog
      const target = cleanedCode.toLowerCase().trim();
      const matchedItem = (currentCatalog || []).find(item => {
        const b = String(item.barcode || '').trim().toLowerCase();
        const code = String(item.code || '').trim().toLowerCase();
        const id = String(item.id || '').trim().toLowerCase();
        return (b && b === target) || (code && code === target) || (id && id === target);
      }) || null;

      const result: ScannedResult = {
        code: cleanedCode,
        item: matchedItem,
        timestamp: Date.now()
      };
      setLastResult(result);
      setScannedQuantity(1);

      if (matchedItem) {
        setScannerState('FOUND');
        const itemName = matchedItem.name || matchedItem.nameEn || matchedItem.name_en || cleanedCode;

        if (activeMode === 'SELL') {
          if (addToCart) {
            addToCart(matchedItem, 1);
          }
          if (itemFound) {
            itemFound(matchedItem);
          }
          setToast({
            message: currentLang === 'ar' ? `✓ تمت إضافة: ${itemName}` : `✓ Added: ${itemName}`,
            type: 'success'
          });
        } else if (activeMode === 'ADD_STOCK') {
          if (addStock) {
            addStock(cleanedCode, matchedItem);
          }
          setToast({
            message: currentLang === 'ar' ? `✓ جلب بيانات الإدخال: ${itemName}` : `✓ Loaded intake: ${itemName}`,
            type: 'info'
          });
          setTimeout(() => {
            if (isMountedRef.current) {
              closeModal();
            }
          }, 600);
        }
      } else {
        setScannerState('NOT_FOUND');
        HardwareIntegrationService.getInstance().playScanError();
        
        if (unknownScanned) {
          unknownScanned(cleanedCode);
        }
        
        setToast({
          message: currentLang === 'ar' ? 'الرمز غير مدرج في الكتالوج' : 'Barcode not found in catalog',
          type: 'error'
        });
      }

      // Unlock for continuous rapid scanning after 1.8s
      setTimeout(() => {
        if (isMountedRef.current) {
          isProcessingRef.current = false;
          setScannerState('SCANNING');
        }
      }, 1800);
    }, 120);
  }, []);

  // Cleanly stop all active streams and decoders
  const stopCameraPipeline = useCallback(async () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Error stopping tracks:', e);
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (html5ScannerRef.current) {
      try {
        if (html5ScannerRef.current.isScanning) {
          await html5ScannerRef.current.stop();
        }
        html5ScannerRef.current.clear();
      } catch (e) {
        console.warn('Html5Qrcode cleanup warning:', e);
      }
      html5ScannerRef.current = null;
    }

    setIsCameraLive(false);
    setTorchOn(false);
    setHasTorchSupport(false);
  }, []);

  // Torch / Flashlight Toggle
  const handleToggleTorch = async () => {
    if (!hasTorchSupport || !streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Flip Camera (Front / Back)
  const handleFlipCamera = async () => {
    await stopCameraPipeline();
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Main Camera Initialization
  const startCameraPipeline = useCallback(async (currentFacing: 'environment' | 'user') => {
    await stopCameraPipeline();

    isProcessingRef.current = false;
    setScannerState('REQUESTING_PERMISSION');
    setErrorMessage(null);

    const isSecure = window.isSecureContext || 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';

    if (!isSecure && window.location.protocol !== 'https:') {
      setScannerState('CAMERA_ERROR');
      setErrorMessage(
        propsRef.current.lang === 'ar' 
          ? 'يتطلب الوصول للكاميرا اتصالاً آمناً (HTTPS). يمكنك استخدام الإدخال اليدوي أدناه.' 
          : 'Camera access requires a secure HTTPS connection. Please use manual barcode entry below.'
      );
      return;
    }

    try {
      // Step 1: Check native BarcodeDetector
      const hasNativeBarcodeDetector = 
        typeof window !== 'undefined' && 
        'BarcodeDetector' in window &&
        typeof (window as any).BarcodeDetector === 'function';

      if (hasNativeBarcodeDetector && videoRef.current) {
        setScannerState('INITIALIZING');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: currentFacing },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 }
          },
          audio: false
        });

        if (!isMountedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && (videoTrack as any).getCapabilities) {
          const caps = (videoTrack as any).getCapabilities();
          setHasTorchSupport(Boolean((caps as any).torch));
        }

        setIsCameraLive(true);
        setScannerState('SCANNING');

        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'data_matrix']
        });

        // Timestamp-gated detection (~12 attempts/sec, matching the proven
        // InlineCameraScanner pattern). The rAF loop keeps running so the
        // video pipeline stays live; only detect() is throttled. First frame
        // runs immediately (epoch anchor = 0), and a pending-detect flag
        // prevents overlapping decode calls.
        let lastDetectTime = 0;
        let isDetecting = false;
        const DETECT_INTERVAL_MS = 80;

        const scanFrameLoop = async () => {
          if (!isMountedRef.current || !videoRef.current || !streamRef.current) return;

          const now = performance.now();
          if (
            videoRef.current.readyState >= 2 && 
            !isProcessingRef.current && 
            !isDetecting &&
            now - lastDetectTime >= DETECT_INTERVAL_MS &&
            videoRef.current.videoWidth > 0
          ) {
            lastDetectTime = now;
            isDetecting = true;
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                processDecodedBarcode(barcodes[0].rawValue);
              }
            } catch (e) {
              // Frame decoding error
            } finally {
              isDetecting = false;
            }
          }

          rafIdRef.current = requestAnimationFrame(scanFrameLoop);
        };

        rafIdRef.current = requestAnimationFrame(scanFrameLoop);
      } else {
        // Step 2: Cross-Browser Html5Qrcode Engine
        setScannerState('INITIALIZING');

        const html5QrCode = new Html5Qrcode(viewportIdRef.current, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.CODE_39
          ],
          verbose: false
        });

        html5ScannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: currentFacing },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.min(viewfinderWidth, viewfinderHeight) * 0.75;
              return { width: Math.max(220, edge), height: Math.max(160, edge * 0.7) };
            },
            aspectRatio: 1.0
          },
          (decodedText) => {
            if (isMountedRef.current) {
              processDecodedBarcode(decodedText);
            }
          },
          () => {}
        );

        if (isMountedRef.current) {
          setIsCameraLive(true);
          setScannerState('SCANNING');
        }
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      if (!isMountedRef.current) return;

      setScannerState('CAMERA_ERROR');
      const errName = err.name || '';
      const currentLang = propsRef.current.lang;
      
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setErrorMessage(
          currentLang === 'ar' 
            ? 'تم رفض إذن الكاميرا من قبل المتصفح. يرجى تفعيل إذن الكاميرا من إعدادات المتصفح أو إدخال الرمز يدوياً.' 
            : 'Camera permission denied. Please allow camera access in browser settings or type the barcode manually.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setScannerState('NO_CAMERA');
        setErrorMessage(
          currentLang === 'ar' 
            ? 'لم يتم العثور على كاميرا في هذا الجهاز.' 
            : 'No camera hardware found on this device.'
        );
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setErrorMessage(
          currentLang === 'ar' 
            ? 'الكاميرا قيد الاستخدام بواسطة تطبيق أو نافذة أخرى. يرجى إغلاق التطبيقات الأخرى والمحاولة مجدداً.' 
            : 'Camera is currently busy or in use by another tab/app. Please close other camera apps and retry.'
        );
      } else {
        setErrorMessage(
          currentLang === 'ar' 
            ? 'تعذر تشغيل الكاميرا. يرجى التحقق من الأذونات أو استخدام الإدخال اليدوي.' 
            : 'Unable to start camera. Please verify permissions or use manual entry.'
        );
      }
    }
  }, [stopCameraPipeline, processDecodedBarcode]);

  // Lifecycle Controller - Only runs when isOpen or facingMode changes
  useEffect(() => {
    isMountedRef.current = true;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCameraPipeline();
      } else if (isOpen && isMountedRef.current) {
        startCameraPipeline(facingMode);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (isOpen) {
      const timer = setTimeout(() => {
        if (isMountedRef.current && !document.hidden) {
          startCameraPipeline(facingMode);
        }
      }, 150);

      return () => {
        clearTimeout(timer);
        stopCameraPipeline();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      stopCameraPipeline();
    }

    return () => {
      isMountedRef.current = false;
      stopCameraPipeline();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, facingMode, startCameraPipeline, stopCameraPipeline]);

  // Handle Manual Barcode Form Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processDecodedBarcode(manualCode.trim());
    setManualCode('');
    setShowManualInput(false);
  };

  // Quick Action from Result Card (e.g. increase quantity)
  const handleAddWithQuantity = () => {
    if (lastResult?.item) {
      if (propsRef.current.onAddToCart) {
        propsRef.current.onAddToCart(lastResult.item, scannedQuantity);
      }
      setToast({
        message: propsRef.current.lang === 'ar' 
          ? `✓ تم تأكيد إضافة ${scannedQuantity} علبة` 
          : `✓ Added ${scannedQuantity} units`,
        type: 'success'
      });
      isProcessingRef.current = false;
      setScannerState('SCANNING');
    }
  };

  if (!isOpen) return null;

  const isDetectedOrFound = scannerState === 'DETECTED' || scannerState === 'LOOKING_UP' || scannerState === 'FOUND';

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md select-none animate-in fade-in duration-200"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      id="central-barcode-scanner-overlay"
    >
      <div 
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-lg bg-slate-950 sm:border sm:border-slate-800 sm:rounded-xl shadow-2xl flex flex-col overflow-hidden text-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
        id="central-barcode-scanner-dialog"
      >
        {/* =========================================================================
            HEADER TOOLBAR (Clinical Green Theme)
            ========================================================================= */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-slate-900 border-b border-slate-800 shrink-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mode Switcher Pill */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentMode('SELL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentMode === 'SELL'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={lang === 'ar' ? 'وضع البيع' : 'POS Sales Mode'}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'بيع' : 'POS'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentMode('ADD_STOCK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentMode === 'ADD_STOCK'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={lang === 'ar' ? 'وضع إدخال المخزون' : 'Inventory Intake Mode'}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إدخال' : 'Intake'}</span>
              </button>
            </div>
          </div>

          {/* Quick Controls: Manual Input, Torch, Flip, Close */}
          <div className="flex items-center gap-1.5">
            {/* Manual Input Toggle */}
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${
                showManualInput 
                  ? 'bg-brand-600 border-brand-500 text-white shadow-md' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title={lang === 'ar' ? 'إدخال يدوي للرمز' : 'Manual Code Input'}
              id="btn-scanner-manual-toggle"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Torch Toggle */}
            {hasTorchSupport && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${
                  torchOn 
                    ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.6)]' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title={lang === 'ar' ? 'تشغيل الفلاش' : 'Toggle Flashlight'}
                id="btn-scanner-torch"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}

            {/* Camera Switcher / Flip */}
            <button
              type="button"
              onClick={handleFlipCamera}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={lang === 'ar' ? 'تبديل الكاميرا' : 'Switch Camera'}
              id="btn-scanner-flip"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Accessible Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl transition-all active:scale-95 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ml-1"
              title={lang === 'ar' ? 'إغلاق (Esc)' : 'Close Scanner (Esc)'}
              id="btn-scanner-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            MANUAL INPUT DRAWER
            ========================================================================= */}
        <AnimatePresence>
          {showManualInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-slate-900 border-b border-slate-800 px-4 py-3 z-30"
            >
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder={lang === 'ar' ? 'أدخل رقم الباركود (مثال: 621000...)' : 'Type barcode number...'}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                >
                  <Search className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'بحث' : 'Search'}</span>
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* =========================================================================
            TOAST NOTIFICATION OVERLAY
            ========================================================================= */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className={`absolute top-16 left-1/2 -translate-x-1/2 z-40 max-w-sm w-[90%] px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 ${
                toast.type === 'success'
                  ? 'bg-brand-950/95 border-brand-500 text-brand-200'
                  : toast.type === 'error'
                  ? 'bg-rose-950/95 border-rose-500 text-rose-200'
                  : 'bg-slate-900/95 border-slate-700 text-slate-200'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Zap className="w-4 h-4 text-brand-400 shrink-0" />
              )}
              <span className="truncate">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* =========================================================================
            VIEWFINDER & CAMERA STREAM CANVAS
            ========================================================================= */}
        <div className="relative flex-1 flex flex-col items-center justify-center bg-slate-950 overflow-hidden min-h-[320px] sm:min-h-[380px]">
          {/* Direct Hardware Video Stream (Native BarcodeDetector) */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Fallback Html5Qrcode Canvas Container */}
          <div 
            id={viewportIdRef.current} 
            className="absolute inset-0 w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          />

          {/* SCANNING RETICLE & TARGET BOX */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-20">
            {/* Target Scan Frame */}
            <div 
              className={`relative w-64 h-48 sm:w-72 sm:h-52 rounded-lg transition-all duration-300 ${
                isDetectedOrFound 
                  ? 'border-2 border-brand-400 bg-brand-500/20 ring-4 ring-brand-500/40' 
                  : currentMode === 'SELL' 
                  ? 'border-2 border-brand-400/80 shadow-[0_0_30px_rgba(16,185,129,0.25)]' 
                  : 'border-2 border-purple-400/80 shadow-[0_0_30px_rgba(168,85,247,0.25)]'
              }`}
            >
              {/* 4 Corner Brackets */}
              <div className={`absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 rounded-tl-xl ${
                currentMode === 'SELL' ? 'border-brand-400' : 'border-purple-400'
              }`} />
              <div className={`absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 rounded-tr-xl ${
                currentMode === 'SELL' ? 'border-brand-400' : 'border-purple-400'
              }`} />
              <div className={`absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 rounded-bl-xl ${
                currentMode === 'SELL' ? 'border-brand-400' : 'border-purple-400'
              }`} />
              <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 rounded-br-xl ${
                currentMode === 'SELL' ? 'border-brand-400' : 'border-purple-400'
              }`} />

              {/* Animated Laser Scanning Line */}
              {scannerState === 'SCANNING' && (
                <motion.div
                  animate={{ y: [8, 175, 8] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                  className={`w-full h-1 rounded-full shadow-lg ${
                    currentMode === 'SELL'
                      ? 'bg-brand-400 shadow-[0_0_15px_#10b981]'
                      : 'bg-purple-400 shadow-[0_0_15px_#a855f7]'
                  }`}
                />
              )}

              {/* Center Target Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <div className="w-6 h-0.5 bg-white rounded" />
                <div className="h-6 w-0.5 bg-white rounded -ml-[3px]" />
              </div>
            </div>

            {/* Instruction Pill */}
            <div className="mt-5 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-semibold text-slate-300 flex items-center gap-2 shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span>
                {lang === 'ar' 
                  ? 'وجّه رمز الباركود داخل الإطار' 
                  : 'Align barcode inside the frame'}
              </span>
            </div>
          </div>

          {/* INITIALIZING SPINNER (Subtle & Non-blocking) */}
          {!isCameraLive && (scannerState === 'INITIALIZING' || scannerState === 'REQUESTING_PERMISSION') && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-center p-6 space-y-3 z-10 pointer-events-none">
              <div className="w-12 h-12 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 animate-pulse">
                <Camera className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white">
                  {scannerState === 'REQUESTING_PERMISSION'
                    ? (lang === 'ar' ? 'طلب إذن الكاميرا...' : 'Requesting Camera Access...')
                    : (lang === 'ar' ? 'جاري تشغيل الكاميرا...' : 'Starting camera video stream...')}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {lang === 'ar' ? 'يرجى توجيه الكاميرا إلى علبة الدواء' : 'Point your camera at the medicine box'}
                </p>
              </div>
            </div>
          )}

          {/* CAMERA ERROR / NO CAMERA OVERLAY */}
          {(scannerState === 'CAMERA_ERROR' || scannerState === 'NO_CAMERA') && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-6 space-y-4 z-20">
              <div className="w-14 h-14 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h4 className="text-sm font-bold text-white">
                  {scannerState === 'NO_CAMERA'
                    ? (lang === 'ar' ? 'لم يتم العثور على كاميرا' : 'No Camera Hardware Found')
                    : (lang === 'ar' ? 'تعذر تشغيل الكاميرا' : 'Camera Unavailable')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {errorMessage || (lang === 'ar' ? 'يرجى التحقق من أذونات المتصفح' : 'Please check browser camera permissions')}
                </p>
              </div>

              {/* Actions: Retry & Manual Entry */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => startCameraPipeline(facingMode)}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry Camera'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إدخال الباركود يدوياً' : 'Manual Barcode Input'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            BOTTOM BAR: SCANNED ITEM CONFIRMATION OR HARDWARE STATUS
            ========================================================================= */}
        <div className="bg-slate-900 border-t border-slate-800 p-4 shrink-0 z-30">
          {lastResult ? (
            <div className="space-y-3 max-w-md mx-auto">
              {/* Top Result Status Header */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-mono text-slate-400">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span>#{lastResult.code}</span>
                </div>

                {lastResult.item ? (
                  <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[11px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'مسجل بالكتالوج' : 'Matched in Catalog'}</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'غير مسجل' : 'Not in Catalog'}</span>
                  </span>
                )}
              </div>

              {/* Medicine Details Card */}
              {lastResult.item ? (
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate">
                      {lastResult.item.name || lastResult.item.nameEn || lastResult.item.name_en}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {lastResult.item.company || lastResult.item.company_name || lastResult.item.form || 'Pharmaceutical Product'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-black font-mono text-brand-400">
                        {Number(lastResult.item.price || 0).toLocaleString()} {lang === 'ar' ? 'ل.س' : 'SYP'}
                      </span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className={`text-[10px] font-bold ${
                        (lastResult.item.stock ?? 1) > 0 ? 'text-brand-400' : 'text-rose-400'
                      }`}>
                        {lang === 'ar' ? 'المخزون:' : 'Stock:'} {lastResult.item.stock ?? 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Quantity and Quick Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800 p-1">
                      <button
                        type="button"
                        onClick={() => setScannedQuantity(q => Math.max(1, q - 1))}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-bold text-xs font-mono text-brand-400">
                        {scannedQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setScannedQuantity(q => q + 1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddWithQuantity}
                      className="p-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md transition-all flex items-center justify-center cursor-pointer min-h-[40px]"
                      title={lang === 'ar' ? 'إضافة للسلة' : 'Add to Cart'}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Unregistered Barcode Action Card */
                <div className="bg-slate-950 p-3 rounded-lg border border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-300">
                      {lang === 'ar' ? 'هذا الباركود غير مسجل في النظام' : 'This barcode is not yet registered'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {lang === 'ar' ? 'يمكنك إضافته كصنف جديد في المستودع' : 'You can intake this as a new product'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (propsRef.current.onAddStockItem) {
                        propsRef.current.onAddStockItem(lastResult.code, null);
                      }
                      onClose();
                    }}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إدخال الصنف' : 'Intake Product'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Idle Hardware & Tips Footer */
            <div className="flex items-center justify-between text-[11px] text-slate-400 max-w-md mx-auto">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                <span>
                  {lang === 'ar' 
                    ? 'الماسح جاهز للعمل (يدعم الكاميرا والماسح السلكي USB)' 
                    : 'Scanner ready (Supports camera & USB barcode readers)'}
                </span>
              </div>
              <span className="font-mono text-slate-500 hidden sm:inline">Esc to close</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
