import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
const dataFile = path.join(dataDir, 'data.json');

// In-memory database replacement for testing (no better-sqlite3 needed)
class SimpleDB {
  constructor() {
    this.vehicles = [];
    this.invoices = [];
    this.services = [];
    this.businessConfig = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        this.vehicles = data.vehicles || [];
        this.invoices = data.invoices || [];
        this.services = data.services || [];
        this.businessConfig = data.businessConfig || {};
      }
    } catch (err) {
      console.warn('Could not load data file:', err.message);
    }
  }

  save() {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(dataFile, JSON.stringify({
        vehicles: this.vehicles,
        invoices: this.invoices,
        services: this.services,
        businessConfig: this.businessConfig
      }, null, 2));
    } catch (err) {
      console.error('Failed to save data:', err.message);
    }
  }

  prepare(sql) {
    return {
      run: (...params) => {
        console.log('SQL:', sql, params);
        return { changes: 1 };
      },
      get: (...params) => null,
      all: (...params) => []
    };
  }

  exec(sql) {
    // No-op for initialization
  }
}

const db = new SimpleDB();

export function initializeDatabase() {
  console.log('Initializing in-memory database (JSON-based)...');

  // Initialize default services
  if (db.services.length === 0) {
    db.services = [
      { id: 1, name: 'Paint Correction', price: 150 },
      { id: 2, name: 'Ceramic Coating', price: 500 },
      { id: 3, name: 'Interior Detailing', price: 200 },
      { id: 4, name: 'Exterior Wash', price: 75 },
      { id: 5, name: 'Wax Application', price: 100 }
    ];
    db.save();
  }

  console.log('Database initialized at', dataFile);
}

export function addVehicle(vin, vehicleData) {
  const existingIdx = db.vehicles.findIndex(v => v.vin === vin);
  if (existingIdx >= 0) {
    db.vehicles[existingIdx] = { ...db.vehicles[existingIdx], ...vehicleData, vin };
  } else {
    db.vehicles.push({ ...vehicleData, vin });
  }
  db.save();
  return db.vehicles.find(v => v.vin === vin);
}

export function getVehicleByVIN(vin) {
  return db.vehicles.find(v => v.vin === vin) || null;
}

export function getAllVehicles() {
  return db.vehicles;
}

export function createInvoice(invoiceData) {
  const invoice = {
    id: db.invoices.length + 1,
    invoiceNumber: `INV-${String(db.invoices.length + 1).padStart(5, '0')}`,
    ...invoiceData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.invoices.push(invoice);
  db.save();
  return invoice;
}

export function getInvoice(id) {
  return db.invoices.find(i => i.id === id) || null;
}

export function getAllInvoices() {
  return db.invoices;
}

export function updateInvoice(id, data) {
  const idx = db.invoices.findIndex(i => i.id === id);
  if (idx >= 0) {
    db.invoices[idx] = { ...db.invoices[idx], ...data, updatedAt: new Date().toISOString() };
    db.save();
    return db.invoices[idx];
  }
  return null;
}

export function deleteInvoice(id) {
  const idx = db.invoices.findIndex(i => i.id === id);
  if (idx >= 0) {
    db.invoices.splice(idx, 1);
    db.save();
    return true;
  }
  return false;
}

export function getServices() {
  return db.services;
}

export function getBusinessConfig() {
  return db.businessConfig;
}

export function updateBusinessConfig(config) {
  db.businessConfig = { ...db.businessConfig, ...config };
  db.save();
  return db.businessConfig;
}

export default db;
