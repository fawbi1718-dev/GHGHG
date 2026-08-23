import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
 size?: 'sm' | 'md' | 'lg';
 isLoading?: boolean;
 leftIcon?: React.ReactNode;
 rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
 className = '',
 variant = 'primary',
 size = 'md',
 isLoading = false,
 leftIcon,
 rightIcon,
 children,
 disabled,
 ...props
}, ref) => {
 const baseStyles = 'inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600/40 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none rounded-md';
 
 const variants = {
 primary: 'bg-slate-900 text-white hover:bg-slate-800',
 secondary: 'bg-brand-50 text-brand-800 border border-brand-200 hover:bg-brand-100',
 outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900',
 ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
 danger: 'bg-rose-700 text-white hover:bg-rose-800'
 };

 const sizes = {
 sm: 'text-xs px-2.5 h-8',
 md: 'text-sm px-3.5 h-9',
 lg: 'text-sm px-5 h-10'
 };

 return (
 <button
 ref={ref}
 className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
 disabled={disabled || isLoading}
 {...props}
 >
 {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
 {children}
 {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
 </button>
 );
});

Button.displayName = 'Button';
