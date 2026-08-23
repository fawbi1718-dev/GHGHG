import React from 'react';
import { Badge } from './Badge';
import type { B2BOrderStatus } from '../../domain/b2b';

interface StatusBadgeProps {
  status: B2BOrderStatus;
  lang?: 'en' | 'ar';
}

const MAP: Record<B2BOrderStatus, { variant: 'success'|'warning'|'error'|'info'; ar: string; en: string }> = {
  PENDING_APPROVAL: { variant: 'warning', ar: 'قيد المعالجة', en: 'Pending' },
  DISPATCHED: { variant: 'info', ar: 'تم الشحن', en: 'Dispatched' },
  RECEIVED: { variant: 'success', ar: 'تم الاستلام', en: 'Received' },
  DRAFT: { variant: 'error', ar: 'مرفوض', en: 'Rejected' },
};

/**
 * Single visual grammar for B2B order state across every surface
 * (tracking cards, dispatch queue rows, order history).
 */
export function StatusBadge({ status, lang = 'en' }: StatusBadgeProps) {
  const cfg = MAP[status] ?? MAP.PENDING_APPROVAL;
  return <Badge variant={cfg.variant}>{lang === 'ar' ? cfg.ar : cfg.en}</Badge>;
}
