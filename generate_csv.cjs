const fs = require('fs');
let csv = "name,scientificName,barcode\n";

// Add some realistic ones first for good measure
const realistic = [
  ["Panadol Advance 500mg", "Paracetamol", "62810001"],
  ["Augmentin 1g", "Amoxicillin Clavulanate", "62810002"],
  ["Brufen 400mg", "Ibuprofen", "62810003"],
  ["Loratadine 10mg", "Loratadine", "62810004"],
  ["Omeprazole 20mg", "Omeprazole", "62810005"],
  ["Zithromax 500mg", "Azithromycin", "62810006"],
  ["Cetamol 500mg", "Paracetamol", "62810007"],
  ["Eltroxin 100mcg", "Levothyroxine", "62810008"],
  ["Concor 5mg", "Bisoprolol", "62810009"],
  ["Glucophage 850mg", "Metformin", "62810010"]
];

for (let r of realistic) {
  csv += `"${r[0]}","${r[1]}","${r[2]}"\n`;
}

for (let i = realistic.length + 1; i <= 602; i++) {
  const code = `01-AA0-${String(i).padStart(3, '0')}`;
  const scientificName = `GenericMed_${i}`;
  const name = `BrandMed_${i}`;
  csv += `"${name}","${scientificName}","${code}"\n`;
}

fs.writeFileSync('essential_medicines_list(6).csv', csv);
console.log("CSV generated.");
