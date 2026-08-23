import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
 icon?: React.ReactNode;
 error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className = '', icon, error, ...props }, ref) => {
 return (
 <div className="relative">
 {icon && (
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
 {icon}
 </div>
 )}
 <input
 ref={ref}
 className={`block w-full rounded-lg border-slate-200 bg-slate-50 border text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-colors sm:text-sm ${icon ? 'pl-10' : 'pl-3'} pr-3 py-2 placeholder-slate-400 disabled:opacity-50 disabled:bg-slate-100 ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''} ${className}`}
 {...props}
 />
 {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
 </div>
 );
});
Input.displayName = 'Input';
