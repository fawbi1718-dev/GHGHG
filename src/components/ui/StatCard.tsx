import React from 'react';
import { Card, CardContent } from './Card';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, className = '' }) => {
  return (
    <Card className={className}>
      <CardContent className="flex items-center p-4 md:p-5">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mr-4 shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-500 mb-1 truncate">{title}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-black text-slate-900 font-mono tracking-tight">{value}</h4>
            {trend && (
              <span className={`text-xs font-bold ${trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
