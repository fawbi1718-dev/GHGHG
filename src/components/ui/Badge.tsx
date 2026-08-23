import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
 variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className = '', variant = 'neutral', ...props }, ref) => {
 const variants = {
 success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
 warning: 'bg-amber-100 text-amber-800 border-amber-200',
 error: 'bg-rose-100 text-rose-800 border-rose-200',
 info: 'bg-blue-100 text-blue-800 border-blue-200',
 neutral: 'bg-slate-100 text-slate-800 border-slate-200'
 };

 return (
 <span
 ref={ref}
 className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border uppercase tracking-wider ${variants[variant]} ${className}`}
 {...props}
 />
 );
});
Badge.displayName = 'Badge';
