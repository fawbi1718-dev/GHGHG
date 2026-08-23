const fs = require('fs');
const categories = ["Painkillers", "Antibiotics", "Allergy", "Digestion", "Hormones", "Cardiology", "Diabetes", "Vitamins", "Dermatology", "Neurology"];
const forms = ["Tablet", "Syrup", "Injection", "Ointment", "Drops", "Inhaler"];
let csv = "name,scientificName,barcode\n";
for (let i = 1; i <= 602; i++) {
  const code = `01-AA0-${String(i).padStart(3, '0')}`;
  const scientificName = `GenericMed_${i}`;
  const name = `BrandMed_${i}`;
  csv += `"${name}","${scientificName}","${code}"\n`;
}
fs.writeFileSync('essential_medicines_list(6).csv', csv);
console.log("CSV generated.");
