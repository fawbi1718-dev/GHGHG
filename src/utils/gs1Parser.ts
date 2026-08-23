import { normalizeBarcode } from '../services/syncEngine';

export interface ParsedBarcode {
  gtin: string;
  raw: string;
  expiry?: string;
  batch?: string;
}

export const parseBarcode = (rawInput: string): ParsedBarcode => {
  if (!rawInput) return { gtin: '', raw: '' };

  // Clean non-printable control characters (\u001d, hidden ASCII, spaces, newlines, quotes)
  const cleaned = normalizeBarcode(rawInput);

  let gtin = cleaned;
  let expiry: string | undefined;
  let batch: string | undefined;

  // Basic GS1 DataMatrix parsing (only when GS1 application identifier syntax is explicitly used)
  if (cleaned.startsWith('(01)') || (cleaned.startsWith('01') && cleaned.length >= 16)) {
    const isBracketed = cleaned.startsWith('(01)');
    const startIdx = isBracketed ? 4 : 2;
    
    if (cleaned.length >= startIdx + 14) {
      gtin = cleaned.substring(startIdx, startIdx + 14);
      
      let remaining = cleaned.substring(startIdx + 14);
      
      // Look for expiry (17)
      const expMatch = remaining.match(/^(?:\(17\)|17)(\d{6})/);
      if (expMatch) {
        expiry = expMatch[1];
        remaining = remaining.substring(expMatch[0].length);
      } else {
        const expMatchAnywhere = remaining.match(/(?:\(17\)|17)(\d{6})/);
        if (expMatchAnywhere) {
          expiry = expMatchAnywhere[1];
        }
      }

      // Look for batch (10)
      const batchMatch = remaining.match(/^(?:\(10\)|10)(.+)$/);
      if (batchMatch) {
        batch = batchMatch[1];
      } else {
        const batchMatchAnywhere = remaining.match(/(?:\(10\)|10)(.+?)(?:\(|$)/);
        if (batchMatchAnywhere) {
          batch = batchMatchAnywhere[1];
        }
      }
    }
  }

  // Barcodes are strictly treated as strings. No padding or numeric conversions.
  return {
    gtin,
    raw: cleaned,
    expiry,
    batch
  };
};

export const getBarcodeVariants = (rawInput: string): string[] => {
  const cleaned = normalizeBarcode(rawInput);
  if (!cleaned) return [];
  
  const variants = new Set<string>();
  variants.add(cleaned);
  
  return Array.from(variants);
};
