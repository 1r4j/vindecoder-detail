import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
const dataFile = path.join(dataDir, 'data.json');

// Simple JSON-based database implementation
class SimpleDB {
  constructor() {
    this.vehicles = [];
    this.invoices = [];
    this.services = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        this.vehicles = data.vehicles || [];
        this.invoices = data.invoices || [];
        this.services = data.services || [];
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
        services: this.services
      }, null, 2));
    } catch (err) {
      console.error('Failed to save data:', err.message);
    }
  }

  prepare(sql) {
    const db = this;

    return {
      run: function(...params) {
        try {
          if (sql.includes('INSERT') && sql.includes('vehicles')) {
            const vehicle = {
              id: db.vehicles.length + 1,
              vin: params[0],
              year: params[1],
              make: params[2],
              model: params[3],
              color: params[4] || '',
              bodyType: params[5] || '',
              engineType: params[6] || '',
              transmission: params[7] || '',
              driveType: params[8] || '',
              gvwr: params[9] || '',
              plant: params[10] || '',
              rawData: params[11] || null,
              scannedAt: new Date().toISOString()
            };

            // Check if vehicle exists
            const existing = db.vehicles.findIndex(v => v.vin === params[0]);
            if (existing === -1) {
              db.vehicles.push(vehicle);
              db.save();
            }
          } else if (sql.includes('UPDATE') && sql.includes('vehicles')) {
            const vin = params[1];
            const vehicle = db.vehicles.find(v => v.vin === vin);
            if (vehicle) {
              vehicle.color = params[0];
              db.save();
            }
          }
          return { changes: 1 };
        } catch (err) {
          console.error('DB run error:', err);
          throw err;
        }
      },

      get: function(...params) {
        try {
          if (sql.includes('SELECT') && sql.includes('WHERE')) {
            if (sql.includes('vehicles')) {
              if (sql.includes('vin')) {
                return db.vehicles.find(v => v.vin === params[0]) || null;
              }
            }
          }
          return null;
        } catch (err) {
          console.error('DB get error:', err);
          return null;
        }
      },

      all: function(...params) {
        try {
          if (sql.includes('SELECT') && sql.includes('vehicles')) {
            if (sql.includes('WHERE LIKE')) {
              const searchTerm = params[0];
              const pattern = searchTerm.replace(/%/g, '').toLowerCase();
              return db.vehicles.filter(v =>
                v.vin.toLowerCase().includes(pattern) ||
                v.make.toLowerCase().includes(pattern) ||
                (v.model && v.model.toLowerCase().includes(pattern))
              ).slice(0, 20);
            } else {
              const limit = params[0] || 100;
              const offset = params[1] || 0;
              return db.vehicles.reverse().slice(offset, offset + limit);
            }
          }
          return [];
        } catch (err) {
          console.error('DB all error:', err);
          return [];
        }
      }
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

export default db;
