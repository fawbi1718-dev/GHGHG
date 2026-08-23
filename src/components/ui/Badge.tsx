import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
 variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className = '', variant = 'neutral', ...props }, ref) => {
 const variants = {
 success: 'bg-white text-brand-700 border-brand-300',
 warning: 'bg-white text-amber-700 border-amber-300',
 error: 'bg-white text-rose-700 border-rose-300',
 info: 'bg-white text-sky-700 border-sky-300',
 neutral: 'bg-slate-50 text-slate-700 border-slate-300'
 };

 return (
 <span
 ref={ref}
 className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold border uppercase tracking-wide ${variants[variant]} ${className}`}
 {...props}
 />
 );
});
Badge.displayName = 'Badge';
