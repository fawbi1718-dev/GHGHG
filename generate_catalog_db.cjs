const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function buildDatabase() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      barcode TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL,
      form TEXT NOT NULL,
      composition_key TEXT NOT NULL,
      dosage TEXT NOT NULL,
      price REAL NOT NULL,
      company_name TEXT NOT NULL,
      uses TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_products_composition ON products(composition_key);
    CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_name);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
  `);

  const initialProducts = [
    // Paracetamol / Acetaminophen (PARACETAMOL_500)
    ['6281001001018', 'بندول 500 ملغ', 'Panadol 500mg', 'Tablet', 'PARACETAMOL_500', '500mg', 4500, 'Ibn Sina Pharma', 'مسكن ألم ومخفض حرارة'],
    ['6281001001025', 'سيتامول 500', 'Cetamol 500mg', 'Tablet', 'PARACETAMOL_500', '500mg', 3200, 'Unipharma', 'مسكن ألم ومخفض حرارة'],
    ['6281001001032', 'بارامول 500', 'Paramol 500mg', 'Tablet', 'PARACETAMOL_500', '500mg', 3000, 'Thameco', 'مسكن ألم ومخفض حرارة'],
    ['6281001001049', 'فيادول 500', 'Fiadol 500mg', 'Tablet', 'PARACETAMOL_500', '500mg', 3100, 'Diamed', 'مسكن ألم ومخفض حرارة'],

    // Ibuprofen (IBUPROFEN_400)
    ['6281002002015', 'بروفين 400', 'Profen 400mg', 'Tablet', 'IBUPROFEN_400', '400mg', 5500, 'Avenzor', 'مضاد التهاب ومسكن للآلام'],
    ['6281002002022', 'إيبوبروفين 400', 'Ibuprofen 400mg', 'Tablet', 'IBUPROFEN_400', '400mg', 4800, 'Unipharma', 'مضاد التهاب غير ستيرويدي'],
    ['6281002002039', 'أدولفين 400', 'Adolfen 400mg', 'Tablet', 'IBUPROFEN_400', '400mg', 4600, 'Medico', 'مسكن للمفاصل والصداع'],

    // Amoxicillin + Clavulanic Acid (AMOXI_CLAV_1G)
    ['6281003003012', 'أوغمنتين 1 غرام', 'Augmentin 1g', 'Tablet', 'AMOXI_CLAV_1G', '1g', 18500, 'Asia Pharma', 'مضاد حيوي واسع الطيف'],
    ['6281003003029', 'كلافوكس 1 غرام', 'Clavox 1g', 'Tablet', 'AMOXI_CLAV_1G', '1g', 15200, 'Barakat Pharma', 'مضاد حيوي واسع الطيف'],
    ['6281003003036', 'أموكلاڤ 1 غرام', 'Amoclav 1g', 'Tablet', 'AMOXI_CLAV_1G', '1g', 14800, 'Ibn Sina Pharma', 'مضاد حيوي لالتهابات التنفس'],

    // Diclofenac Sodium (DICLOFENAC_50)
    ['6281004004019', 'فولتارين 50 ملغ', 'Voltaren 50mg', 'Tablet', 'DICLOFENAC_50', '50mg', 7200, 'Unipharma', 'مسكن آلام ومضاد تورم'],
    ['6281004004026', 'كتافلام 50 ملغ', 'Cataflam 50mg', 'Tablet', 'DICLOFENAC_50', '50mg', 6800, 'Avenzor', 'مسكن سريع لآلام الأسنان والمفاصل'],
    ['6281004004033', 'ديكلوفين 50', 'Diclofen 50mg', 'Tablet', 'DICLOFENAC_50', '50mg', 5200, 'Al-Fares Pharma', 'مضاد التهاب المفاصل'],

    // Omeprazole (OMEPRAZOLE_20)
    ['6281005005016', 'أوميز 20 ملغ', 'Omez 20mg', 'Capsule', 'OMEPRAZOLE_20', '20mg', 9800, 'Ibn Sina Pharma', 'علاج حموضة المعدة والقرحة'],
    ['6281005005023', 'غاسيك 20 ملغ', 'Gasec 20mg', 'Capsule', 'OMEPRAZOLE_20', '20mg', 8500, 'Thameco', 'مُثبط مضخة البروتون للحموضة'],
    ['6281005005030', 'لوميك 20 ملغ', 'Lomec 20mg', 'Capsule', 'OMEPRAZOLE_20', '20mg', 8200, 'Diamed', 'حماية المعدة وحرقة المريء'],

    // Metformin (METFORMIN_500)
    ['6281006006013', 'غلوكوفاج 500', 'Glucophage 500mg', 'Tablet', 'METFORMIN_500', '500mg', 6200, 'Asia Pharma', 'خافض لسكّري الدم من النمط الثاني'],
    ['6281006006020', 'ديافاج 500', 'Diaphage 500mg', 'Tablet', 'METFORMIN_500', '500mg', 4900, 'Unipharma', 'تنظيم مستويات السكر بالدم'],
    ['6281006006037', 'ميتفورال 500', 'Metforal 500mg', 'Tablet', 'METFORMIN_500', '500mg', 4500, 'Medico', 'خافض سكري'],

    // Bisoprolol (BISOPROLOL_5)
    ['6281007007010', 'كونكور 5 ملغ', 'Concor 5mg', 'Tablet', 'BISOPROLOL_5', '5mg', 11500, 'Avenzor', 'خافض ضغط الدم ومنظم ضربات القلب'],
    ['6281007007027', 'بيسوكور 5 ملغ', 'Bisocor 5mg', 'Tablet', 'BISOPROLOL_5', '5mg', 9200, 'Barakat Pharma', 'علاج ارتفاع الضغط الشرياني'],

    // Atorvastatin (ATORVASTATIN_20)
    ['6281008008017', 'ليبيتور 20 ملغ', 'Lipitor 20mg', 'Tablet', 'ATORVASTATIN_20', '20mg', 16500, 'Ibn Sina Pharma', 'خافض الكوليسترول والدهون الثلاثية'],
    ['6281008008024', 'أتورفا 20 ملغ', 'Atorva 20mg', 'Tablet', 'ATORVASTATIN_20', '20mg', 13800, 'Al-Fares Pharma', 'خافض كوليسترول الدم'],

    // Azithromycin (AZITHROMYCIN_500)
    ['6281009009014', 'زيثروماكس 500', 'Zithromax 500mg', 'Tablet', 'AZITHROMYCIN_500', '500mg', 14200, 'Asia Pharma', 'مضاد حيوي لالتهابات التنفس والجهاز البولي'],
    ['6281009009021', 'أزيترو 500', 'Azitro 500mg', 'Tablet', 'AZITHROMYCIN_500', '500mg', 11800, 'Diamed', 'مضاد حيوي واسع الطيف']
  ];

  const stmt = db.prepare(`
    INSERT INTO products (barcode, name, name_en, form, composition_key, dosage, price, company_name, uses)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of initialProducts) {
    stmt.run(item);
  }
  stmt.free();

  const data = db.export();
  const buffer = Buffer.from(data);

  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const dbPath1 = path.join(publicDir, 'app_catalog_v1.db');
  const dbPath2 = path.join(publicDir, 'zena_pharma_catalog.db');
  fs.writeFileSync(dbPath1, buffer);
  fs.writeFileSync(dbPath2, buffer);
  console.log(`Successfully generated SQLite database at: ${dbPath1} and ${dbPath2} (${buffer.length} bytes)`);
}

buildDatabase().catch(err => {
  console.error('Failed to build catalog DB:', err);
});
