import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  fullScreenOnMobile?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
  fullScreenOnMobile = false
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    'full': 'max-w-[95vw]'
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 isolate overflow-y-auto pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 transition-opacity pointer-events-auto"
          />
          <div className="relative z-10 w-full flex justify-center items-center pointer-events-none my-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className={`w-full bg-white shadow-xl pointer-events-auto flex flex-col overflow-hidden rounded-lg border border-slate-300 ${maxWidthClasses[maxWidth]} ${
                fullScreenOnMobile ? 'h-full sm:h-auto sm:max-h-[90vh] sm:rounded-lg rounded-none' : 'max-h-[88vh]'
              }`}
            >
              {title && (
                <div className="flex items-center justify-between px-4 py-4 md:px-6 border-b border-slate-100 shrink-0">
                  <h3 className="text-lg font-bold text-slate-900 truncate pr-4">{title}</h3>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              
              <div className="flex-1 overflow-y-auto p-4 md:p-6 relative">
                {children}
              </div>

              {footer && (
                <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 shrink-0">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(modalContent, document.body);
};
