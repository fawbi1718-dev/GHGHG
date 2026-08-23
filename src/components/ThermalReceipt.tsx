import React from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { SaleTransaction } from '../application/hooks/useReceiptPrinter';
import { useAuth } from '../application/auth/AuthContext';

interface ThermalReceiptProps {
 data: SaleTransaction;
}

export default function ThermalReceipt({ data }: ThermalReceiptProps) {
 const { currentSession } = useAuth();
 
 // A standard 80mm thermal receipt width translates roughly to ~302px (at 96 DPI)
 // We'll use mm units where possible or a fixed container width to match 80mm.
 const receiptContent = (
 <div 
 id="printable-receipt" 
 className="bg-white text-black text-[12px] leading-tight font-mono p-2 mx-auto"
 style={{ width: '80mm', minHeight: '100mm' }}
 >
 {/* Header */}
 <div className="text-center mb-4 space-y-1">
 <h1 className="text-[18px] font-bold tracking-widest uppercase">
 {currentSession?.name || 'PHARMACY DEMO'}
 </h1>
 <p className="text-[10px]">License # {currentSession?.pharmacyId?.substring(0, 8).toUpperCase() || 'PH-0001'}</p>
 <p className="text-[10px]">Tax ID: 882-991-334</p>
 <p className="text-[10px]">123 Main St, Cityville</p>
 <p className="text-[10px]">Tel: +1 (555) 123-4567</p>
 </div>

 <div className="border-t border-b border-black py-2 mb-3 space-y-1">
 <div className="flex justify-between">
 <span>Date:</span>
 <span>{new Date(data.date).toLocaleString()}</span>
 </div>
 <div className="flex justify-between">
 <span>Order ID:</span>
 <span>{data.orderId}</span>
 </div>
 <div className="flex justify-between">
 <span>Cashier:</span>
 <span>{data.cashierName || currentSession?.name || 'Staff'}</span>
 </div>
 </div>

 {/* Line Items */}
 <table className="w-full text-left mb-3 border-collapse">
 <thead>
 <tr className="border-b border-black text-[10px]">
 <th className="py-1 w-8">QTY</th>
 <th className="py-1">ITEM</th>
 <th className="py-1 text-right">TOTAL</th>
 </tr>
 </thead>
 <tbody className="text-[11px]">
 {data.items.map((item, idx) => (
 <tr key={idx} className="border-b border-black border-dotted last:border-none">
 <td className="py-2 align-top font-bold">{item.quantity}</td>
 <td className="py-2 pr-2">
 <div className="font-bold">{item.name}</div>
 {item.genericName && (
 <div className="text-[9px] uppercase tracking-wider">{item.genericName}</div>
 )}
 <div className="text-[9px] mt-0.5">${item.unitPrice.toFixed(2)} each</div>
 </td>
 <td className="py-2 text-right align-top font-bold text-[12px]">
 ${item.total.toFixed(2)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>

 {/* Financials */}
 <div className="border-t border-black pt-2 mb-4 space-y-1 text-[12px]">
 <div className="flex justify-between">
 <span>Subtotal:</span>
 <span>${data.subtotal.toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span>Tax (0%):</span>
 <span>${data.tax.toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span>Discount:</span>
 <span>-${data.discount.toFixed(2)}</span>
 </div>
 <div className="flex justify-between font-bold text-[16px] py-2 border-y border-black mt-2">
 <span>TOTAL:</span>
 <span>${data.finalTotal.toFixed(2)}</span>
 </div>
 
 <div className="flex justify-between pt-2">
 <span>Paid ({data.paymentMethod}):</span>
 <span>${data.finalTotal.toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span>Change Due:</span>
 <span>${data.changeDue.toFixed(2)}</span>
 </div>
 </div>

 {/* Footer */}
 <div className="text-center mt-6 pt-4 border-t border-black">
 <div className="flex justify-center mb-3">
 <QRCodeSVG value={data.orderId} size={80} level="M" />
 </div>
 <p className="text-[10px] uppercase font-bold tracking-widest">{data.orderId}</p>
 <p className="mt-3 text-[9px] leading-tight">
 Returns accepted within 14 days with original receipt. <br />
 Thank you for choosing us!
 </p>
 </div>
 
 {/* Feed paper slightly at end */}
 <div className="h-8"></div>
 </div>
 );

 return createPortal(receiptContent, document.body);
}
