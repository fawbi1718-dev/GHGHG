import React from 'react';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
 <div ref={ref} className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`} {...props} />
));
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
 <div ref={ref} className={`px-4 py-4 md:px-6 border-b border-slate-100 flex flex-col gap-1 ${className}`} {...props} />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className = '', ...props }, ref) => (
 <h3 ref={ref} className={`text-lg font-bold text-slate-900 tracking-tight ${className}`} {...props} />
));
CardTitle.displayName = 'CardTitle';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
 <div ref={ref} className={`p-4 md:p-6 ${className}`} {...props} />
));
CardContent.displayName = 'CardContent';
