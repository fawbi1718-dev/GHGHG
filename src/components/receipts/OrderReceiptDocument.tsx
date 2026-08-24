import React from 'react';
import { StatusBadge } from '../ui/StatusBadge';

export interface OrderReceiptProps {
  order: {
    orderId: string;
    status: string;
    createdAt?: string;
    updatedAt?: string;
    buyerName?: string;
    buyerNameAr?: string;
    buyerTenantId?: string;
    buyerPhone?: string;
    buyerAddress?: string;
    sellerName?: string;
    sellerNameAr?: string;
    sellerTenantId?: string;
    sellerPhone?: string;
    items?: { name?: string; nameAr?: string; requestedQuantity?: number; costAtOrder?: number }[];
    totalValue?: number;
    manifest?: { dispatchToken?: string; expectedDeliveryAt?: string; deliveryWindowEnd?: string } | null;
  };
  /** 'buyer' = pharmacy copy, 'seller' = warehouse copy (affects footer labels only). */
  copyFor?: 'buyer' | 'seller';
  lang?: 'en' | 'ar';
}

const cell: React.CSSProperties = { padding: '6px 4px', verticalAlign: 'top' };

function fmtSYP(n: number) { return (Number(n) || 0).toLocaleString() + ' SYP'; }

/**
 * Shared printable order receipt used across the platform.
 * Render inside a `#printable-order-receipt` container so the global
 * @media print rules isolate it from navigation and controls.
 */
export default function OrderReceiptDocument({ order, copyFor = 'buyer', lang = 'en' }: OrderReceiptProps) {
  const ar = lang === 'ar';
  const items = order.items || [];
  const total = Number(order.totalValue) || items.reduce(
    (s, it) => s + (Number(it.requestedQuantity) || 0) * (Number(it.costAtOrder) || 0), 0);

  const statusText =
    order.status === 'PENDING_APPROVAL' ? (ar ? 'قيد المعالجة' : 'Pending') :
    order.status === 'DISPATCHED' ? (ar ? 'تم الشحن' : 'Dispatched') :
    order.status === 'RECEIVED' ? (ar ? 'تم الاستلام' : 'Received') :
    order.status === 'DRAFT' ? (ar ? 'مرفوض' : 'Rejected') : order.status;

  return (
    <div
      id="printable-order-receipt"
      style={{ position: 'fixed', left: 0, top: 0, width: '100%', background: '#fff', color: '#0f172a', padding: 24 }}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: '#0f766e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>E</div>
            <div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Eshmun</p>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
                {copyFor === 'seller' ? (ar ? 'سند تجهيز — المستودع' : 'Warehouse Dispatch Copy') : (ar ? 'إيصال طلبية — الصيدلية' : 'Pharmacy Order Copy')}
              </p>
            </div>
          </div>
          <StatusBadge status={order.status} lang={lang} />
        </div>

        {/* Parties */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700 }}>
              {ar ? 'الطالب — صيدلية' : 'Buyer — Pharmacy'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 800 }}>{order.buyerName || order.buyerNameAr || order.buyerTenantId}</p>
            {order.buyerPhone && <p style={{ margin: '2px 0 0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{order.buyerPhone}</p>}
            {(order.buyerAddress || order.buyerCity) && (
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#475569' }}>{order.buyerAddress || order.buyerCity}</p>
            )}
          </div>
          <div style={{ textAlign: ar ? 'left' : 'right' }}>
            <p style={{ margin: 0, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700 }}>
              {ar ? 'المورّد — مستودع' : 'Seller — Warehouse'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 800 }}>{order.sellerName || order.sellerTenantId}</p>
            {order.sellerPhone && <p style={{ margin: '2px 0 0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">{order.sellerPhone}</p>}
          </div>
        </div>

        {/* Meta */}
        <table style={{ width: '100%', fontSize: 11, marginBottom: 12, borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '3px 0', color: '#64748b', width: 130 }}>{ar ? 'رقم الطلب' : 'Order ref'}</td><td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>#{order.orderId}</td></tr>
            <tr><td style={{ padding: '3px 0', color: '#64748b' }}>{ar ? 'تاريخ الطلب' : 'Order date'}</td><td>{order.createdAt ? new Date(order.createdAt).toLocaleString(ar ? 'ar-SY' : 'en-GB') : '—'}</td></tr>
            {order.manifest?.expectedDeliveryAt && (
              <tr><td style={{ padding: '3px 0', color: '#64748b' }}>{ar ? 'موعد التسليم' : 'Expected delivery'}</td><td>{new Date(order.manifest.expectedDeliveryAt).toLocaleString(ar ? 'ar-SY' : 'en-GB')}</td></tr>
            )}
            {order.manifest?.dispatchToken && (
              <tr><td style={{ padding: '3px 0', color: '#64748b' }}>{ar ? 'رمز الشحن' : 'Dispatch token'}</td><td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{order.manifest.dispatchToken}</td></tr>
            )}
            <tr><td style={{ padding: '3px 0', color: '#64748b' }}>{ar ? 'الحالة' : 'Status'}</td><td style={{ fontWeight: 800 }}>{statusText}</td></tr>
          </tbody>
        </table>

        {/* Items */}
        <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse', marginBottom: 6 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: ar ? 'right' : 'left' }}>
              <th style={{ padding: '5px 6px', borderBottom: '1px solid #cbd5e1' }}>{ar ? 'المادة' : 'Item'}</th>
              <th style={{ padding: '5px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'center' }}>{ar ? 'الكمية' : 'Qty'}</th>
              <th style={{ padding: '5px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'center' }}>{ar ? 'سعر الوحدة' : 'Unit'}</th>
              <th style={{ padding: '5px 6px', borderBottom: '1px solid #cbd5e1', textAlign: ar ? 'left' : 'right' }}>{ar ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td style={{ padding: '5px 6px', borderBottom: '1px solid #e2e8f0' }}>{(ar && it.nameAr) ? it.nameAr : (it.nameEn || it.name)}</td>
                <td style={{ padding: '5px 6px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>{it.requestedQuantity ?? it.approvedQuantity ?? 0}</td>
                <td style={{ padding: '5px 6px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>{fmtSYP(it.costAtOrder)}</td>
                <td style={{ padding: '5px 6px', borderBottom: '1px solid #e2e8f0', textAlign: ar ? 'left' : 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                  {fmtSYP((Number(it.requestedQuantity) || 0) * (Number(it.costAtOrder) || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', marginTop: 4, paddingTop: 8, fontSize: 14, fontWeight: 800 }}>
          <span>{ar ? 'الإجمالي العام' : 'Order total'}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtSYP(order.totalValue ?? items.reduce((s, it) => s + (Number(it.requestedQuantity) || 0) * (Number(it.costAtOrder) || 0), 0))}</span>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 22, paddingTop: 8, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
          <span>{copyFor === 'seller' ? (ar ? 'استلمتها: ________________' : 'Received by: ________________') : (ar ? 'توقيع الصيدلي: ________________' : 'Pharmacist signature: ________________')}</span>
          <span>{ar ? 'طُبعت في: ' : 'Printed: '}{new Date().toLocaleString(ar ? 'ar-SY' : 'en-GB')}</span>
        </div>
      </div>
    </div>
  );
}
