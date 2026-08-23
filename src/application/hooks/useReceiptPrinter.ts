import { useState, useCallback } from 'react';

export interface PrintLineItem {
 id: string;
 name: string;
 genericName?: string;
 quantity: number;
 unitPrice: number;
 total: number;
}

export interface SaleTransaction {
 orderId: string;
 date: string;
 items: PrintLineItem[];
 subtotal: number;
 tax: number;
 discount: number;
 finalTotal: number;
 paymentMethod: string;
 changeDue: number;
 cashierName?: string;
}

export function useReceiptPrinter() {
 const [printData, setPrintData] = useState<SaleTransaction | null>(null);

 const printReceipt = useCallback((saleData: SaleTransaction) => {
 setPrintData(saleData);
 
 // Give React a moment to render the receipt component to the DOM
 setTimeout(() => {
 window.print();
 
 // Cleanup after print dialog closes (or when it's done)
 // Some browsers block execution during window.print, some don't.
 // A small delay ensures we clear the state after.
 setTimeout(() => {
 setPrintData(null);
 }, 500);
 }, 150);
 }, []);

 return {
 printData,
 printReceipt,
 clearReceipt: () => setPrintData(null)
 };
}
