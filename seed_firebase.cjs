/**
 * Firebase Firestore Catalog Seeder Script
 * ----------------------------------------
 * Reads SQLite database file (app_catalog_v1.db, zena_pharma_catalog.db, or custom path)
 * and seeds all records directly into Firebase Firestore 'catalog' collection.
 * 
 * Usage:
 *   node seed_firebase.cjs [path_to_db_file]
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, writeBatch, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB55OA7v8uY9FjPHOQb1ZBoVumhywhbR4U",
  authDomain: "saidalete.firebaseapp.com",
  projectId: "saidalete",
  storageBucket: "saidalete.firebasestorage.app",
  messagingSenderId: "913291699685",
  appId: "1:913291699685:web:0ffe68938d83506ef17b0c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runSeed() {
  const dbFileName = process.argv[2] || 'app_catalog_v1.db';
  const dbPath = path.isAbsolute(dbFileName) 
    ? dbFileName 
    : path.join(__dirname, 'public', dbFileName);

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ SQLite Database file not found at: ${dbPath}`);
    console.log(`Please place your .db file in /public directory or pass its exact path.`);
    process.exit(1);
  }

  console.log(`📦 Loading SQLite database from: ${dbPath}...`);
  const fileBuffer = fs.readFileSync(dbPath);

  const SQL = await initSqlJs();
  const sqliteDb = new SQL.Database(fileBuffer);

  // Detect table name
  const tablesRes = sqliteDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  if (!tablesRes.length || !tablesRes[0].values.length) {
    console.error('❌ No tables found inside the SQLite database file!');
    process.exit(1);
  }

  const tableNames = tablesRes[0].values.map(v => String(v[0]));
  const tableName = tableNames.find(t => t.toLowerCase().includes('product')) ||
                    tableNames.find(t => t.toLowerCase().includes('med')) ||
                    tableNames.find(t => t.toLowerCase().includes('drug')) ||
                    tableNames[0];

  console.log(`🔍 Reading table: "${tableName}"...`);
  const stmt = sqliteDb.prepare(`SELECT * FROM "${tableName}"`);
  
  const items = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    items.push({
      barcode: String(row.barcode || row.bar_code || row.code || row.id || Math.random().toString()),
      name: String(row.name || row.trade_name || row.name_ar || 'Unknown Drug'),
      name_en: String(row.name_en || row.english_name || row.name || 'Unknown Drug'),
      form: String(row.form || row.dosage_form || 'Tablet'),
      composition_key: String(row.composition_key || row.active_ingredient || row.generic_name || 'GENERAL'),
      dosage: String(row.dosage || row.concentration || 'Standard'),
      price: Number(row.price || row.unit_price || row.price_syria || 0),
      company_name: String(row.company_name || row.company || row.manufacturer || 'Syrian Pharma'),
      uses: String(row.uses || row.description || row.indications || '')
    });
  }
  stmt.free();

  console.log(`⚡ Found ${items.length.toLocaleString()} drug records in SQLite file.`);
  console.log(`🔥 Starting batch seed into Firebase Firestore [Project: saidalete, Collection: "catalog"]...`);

  const catalogCol = collection(db, 'catalog');
  let batch = writeBatch(db);
  let count = 0;

  for (const item of items) {
    const cleanDocId = item.barcode ? String(item.barcode).replace(/[\/\s]/g, '_') : doc(catalogCol).id;
    const docRef = doc(catalogCol, cleanDocId);
    batch.set(docRef, { ...item, syncedAt: new Date().toISOString() });
    count++;

    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
      const pct = Math.round((count / items.length) * 100);
      console.log(`   Progress: ${count.toLocaleString()} / ${items.length.toLocaleString()} (${pct}%) written to Firestore...`);
    }
  }

  if (count % 400 !== 0) {
    await batch.commit();
  }

  console.log(`✅ Success! ${count.toLocaleString()} drug records uploaded to Firebase Firestore!`);
  process.exit(0);
}

runSeed().catch(err => {
  console.error('❌ Error during Firebase seed:', err);
  process.exit(1);
});
