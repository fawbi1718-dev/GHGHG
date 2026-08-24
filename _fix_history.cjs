const fs = require('fs');
const file = 'src/components/warehouse/B2BQueueTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

// Find the history actions row and check the div balance after it.
let btnIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('btn-print-history-')) { btnIdx = i; break; }
}
if (btnIdx === -1) { console.error('history print button not found'); process.exit(1); }

// Walk forward: the button closes, then its wrapper div closes, then we may
// have an extra stray </div> left from the broken earlier edit.
let depth = 1; // inside the button
let extraCloseIdx = -1;
for (let j = btnIdx; j < Math.min(btnIdx + 14, lines.length); j++) {
  const l = lines[j];
  if (l.includes('Print receipt') || l.includes('</button>')) continue;
  if (/^\s*<\/div>\s*$/.test(l)) { extraCloseIdx = j; break; }
}

if (extraCloseIdx !== -1) {
  console.log('extra </div> found at line', extraCloseIdx + 1, '- removing');
  lines.splice(extraCloseIdx, 1);
  fs.writeFileSync(file, lines.join('\n'));
  console.log('fixed');
} else {
  console.log('no stray close found — structure already balanced?');
  // print surrounding for manual inspection
  console.log(lines.slice(btnIdx - 2, btnIdx + 10).join('\n'));
}
