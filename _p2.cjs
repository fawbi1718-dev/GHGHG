const fs = require('fs');
const file = 'src/components/warehouse/B2BQueueTab.tsx';
let t = fs.readFileSync(file, 'utf8');
let changed = false;

// A. Print button in active-card header (after orderId chip)
const chipAnchor = '                      <span className="font-mono text-xs font-bold text-brand-800 bg-white px-2.5 py-0.5 rounded-md border border-brand-200 shadow-2xs">\n                        #{order.orderId}\n                      </span>';
if (t.includes(chipAnchor) && !t.includes('btn-print-queue-')) {
  const btn =
'                      <button\n' +
'                        id={`btn-print-queue-${order.orderId}`}\n' +
'                        onClick={() => setReceiptOrderId(order.orderId)}\n' +
'                        title={lang === \'ar\' ? \'طباعة إيصال الطلبية\' : \'Print order receipt\'}\n' +
'                        className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-brand-700 hover:border-brand-300 transition-colors cursor-pointer shrink-0"\n' +
'                      >\n' +
'                        <Printer className="w-3.5 h-3.5" />\n' +
'                      </button>';
  t = t.replace(chipAnchor, chipAnchor + '\n' + btn);
  changed = true;
}

// B. Print button inside history expanded actions
const metaAnchor = "              <span>{(o.items || []).length} {lang === 'ar' ? 'أصناف' : 'items'}</span>";
if (t.includes(metaAnchor)) {
  const after = metaAnchor + '\n            </div>\n            <div className="flex justify-end pt-1">\n              <button\n                id={`btn-print-history-${o.orderId}`}\n                onClick={() => setReceiptOrderId(o.orderId)}\n                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer transition-colors"\n              >\n                {lang === \'ar\' ? \'🖨 طباعة\' : \'🖨 Print receipt\'}\n              </button>\n            </div>';
  t = t.replace(metaAnchor + '\n            </div>', after);
  changed = true;
}

fs.writeFileSync(file, t);
console.log('changed:', changed);
