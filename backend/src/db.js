import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/app.db');

const db = new Database(dbPath);

export function initializeDatabase() {
  console.log('Initializing database...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vin TEXT UNIQUE NOT NULL,
      year INTEGER,
      make TEXT,
      model TEXT,
      color TEXT,
      bodyType TEXT,
      engineType TEXT,
      transmission TEXT,
      driveType TEXT,
      gvwr TEXT,
      plant TEXT,
      rawData TEXT,
      scannedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNumber TEXT UNIQUE NOT NULL,
      invoiceId TEXT UNIQUE NOT NULL,
      vehicleId INTEGER,
      vin TEXT,
      vehicleYear INTEGER,
      vehicleMake TEXT,
      vehicleModel TEXT,
      vehicleColor TEXT,
      customerName TEXT NOT NULL,
      customerEmail TEXT,
      customerPhone TEXT,
      customerAddress TEXT,
      serviceDate DATE,
      invoiceDate DATE DEFAULT CURRENT_DATE,
      subtotal REAL,
      taxRate REAL DEFAULT 0.08,
      taxAmount REAL,
      discountType TEXT,
      discountValue REAL DEFAULT 0,
      totalAmount REAL,
      paymentStatus TEXT DEFAULT 'pending',
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicleId) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS invoiceItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceId INTEGER NOT NULL,
      serviceName TEXT NOT NULL,
      description TEXT,
      quantity REAL DEFAULT 1,
      rate REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      defaultPrice REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS businessConfig (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      businessName TEXT DEFAULT 'Sparkle Auto Detailing',
      businessAddress TEXT DEFAULT '123 Main Street, Your City, State 12345',
      businessPhone TEXT DEFAULT '(555) 987-6543',
      businessEmail TEXT DEFAULT 'info@sparkledetail.com',
      taxRate REAL DEFAULT 0.08,
      invoicePrefix TEXT DEFAULT 'INV',
      paymentTermsDays INTEGER DEFAULT 14,
      currencySymbol TEXT DEFAULT '$'
    );
  `);

  const services = [
    { name: 'Exterior Wash', description: 'Full body wash, rinse, dry', price: 50.00 },
    { name: 'Interior Vacuum', description: 'Seats, floor, trunk', price: 40.00 },
    { name: 'Ceramic Coat', description: 'Premium 2-year coating', price: 150.00 },
    { name: 'Window Cleaning', description: 'Interior and exterior windows', price: 25.00 },
    { name: 'Tire Shine', description: 'Professional tire dressing', price: 20.00 },
    { name: 'Clay Bar Treatment', description: 'Remove contaminants from paint', price: 60.00 },
    { name: 'Wax Application', description: 'Carnauba or synthetic wax', price: 80.00 },
    { name: 'Leather Conditioning', description: 'Condition and protect leather seats', price: 75.00 }
  ];

  const checkServices = db.prepare('SELECT COUNT(*) as count FROM services');
  if (checkServices.get().count === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (name, description, defaultPrice)
      VALUES (?, ?, ?)
    `);
    services.forEach(service => {
      insertService.run(service.name, service.description, service.price);
    });
  }

  const checkConfig = db.prepare('SELECT COUNT(*) as count FROM businessConfig');
  if (checkConfig.get().count === 0) {
    db.prepare(`
      INSERT INTO businessConfig (id, businessName, businessAddress, businessPhone, businessEmail, taxRate, invoicePrefix, paymentTermsDays, currencySymbol)
      VALUES (1, 'Sparkle Auto Detailing', '123 Main Street, Your City, State 12345', '(555) 987-6543', 'info@sparkledetail.com', 0.08, 'INV', 14, '$')
    `).run();
  }

  const tableInfo = db.prepare("PRAGMA table_info(invoices)").all();
  console.log('Invoices table columns:', tableInfo.map(col => col.name));
}

export default db;
