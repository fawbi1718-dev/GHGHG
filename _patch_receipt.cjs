const fs = require('fs');
const file = 'src/components/B2BMarketplaceTab.tsx';
let t = fs.readFileSync(file, 'utf8');

const start = t.indexOf('      {/* Printable order receipt (pharmacy copy)');
const endAnchor = '\n      </main>';
const end = t.indexOf(endAnchor, start);
if (start < 0 || end < 0) { console.error('anchors miss', start, end); process.exit(1); }

const replacement =
'      {printTarget && (\n' +
'        <OrderReceiptDocument\n' +
'          order={printTarget}\n' +
'          copyFor="buyer"\n' +
'          lang={lang}\n' +
'        />\n' +
'      )}' +
t.slice(end);

t = t.replace(
  "import { StatusBadge } from './ui/StatusBadge';",
  "import { StatusBadge } from './ui/StatusBadge';\nimport OrderReceiptDocument from './receipts/OrderReceiptDocument';"
);

fs.writeFileSync(file, t);
console.log('marketplace receipt swapped; import added:', t.includes('OrderReceiptDocument'));
