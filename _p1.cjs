const fs = require('fs');
const file = 'src/components/warehouse/B2BQueueTab.tsx';
let t = fs.readFileSync(file, 'utf8');
let changed = false;

// 1. Import shared receipt component
if (!t.includes('OrderReceiptDocument')) {
  t = t.replace(
    "import { Skeleton } from '../ui/Skeleton';",
    "import { Skeleton } from '../ui/Skeleton';\nimport OrderReceiptDocument from '../receipts/OrderReceiptDocument';"
  );
  changed = true;
}

// 2. Receipt state (after expandedHistoryId)
if (!t.includes('receiptOrderId')) {
  t = t.replace(
    "  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);",
    "  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);\n" +
    "  // Printable order receipt (warehouse copy)\n" +
    "  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);"
  );
  changed = true;
}

fs.writeFileSync(file, t);
console.log('B2BQueueTab state/import pass done:', changed);
