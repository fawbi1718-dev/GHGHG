import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  position?: 'right' | 'left' | 'bottom';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  position = 'right',
  maxWidth = 'md'
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
    sm: 'sm:max-w-sm md:w-96',
    md: 'sm:max-w-md md:w-[28rem]',
    lg: 'sm:max-w-lg md:w-[32rem]',
    xl: 'sm:max-w-xl md:w-[36rem]',
    '2xl': 'sm:max-w-2xl md:w-[42rem]'
  };

  const slideVariants = {
    right: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } },
    left: { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
    bottom: { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
  };

  const positionClasses = {
    right: 'top-0 right-0 bottom-0 border-l',
    left: 'top-0 left-0 bottom-0 border-r',
    bottom: 'bottom-0 left-0 right-0 border-t sm:rounded-t-2xl'
  };

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] isolate">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          />
          <motion.div
            {...slideVariants[position]}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className={`absolute ${positionClasses[position]} w-full ${position !== 'bottom' ? maxWidthClasses[maxWidth] : 'h-[85vh] sm:h-auto sm:max-h-[90vh]'} bg-white shadow-2xl flex flex-col z-10`}
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
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(drawerContent, document.body);
};
