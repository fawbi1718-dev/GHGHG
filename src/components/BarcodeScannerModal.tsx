import React from 'react';
import CentralScannerModal, { CatalogItem, CentralScannerModalProps } from './scanner/CentralScannerModal';

export type { CatalogItem, CentralScannerModalProps as BarcodeScannerModalProps };

export default function BarcodeScannerModal(props: CentralScannerModalProps & {
  onAddToB2BOrder?: (item: CatalogItem, quantity?: number) => void;
}) {
  return (
    <CentralScannerModal
      {...props}
      mode={props.mode || 'SELL'}
    />
  );
}
