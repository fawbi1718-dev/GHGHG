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
 const baseStyles = 'inline-flex items-center justify-center font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-lg';
 
 const variants = {
 primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
 secondary: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
 outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm',
 ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
 danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm'
 };

 const sizes = {
 sm: 'text-xs px-3 py-1.5',
 md: 'text-sm px-4 py-2',
 lg: 'text-base px-6 py-3'
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
