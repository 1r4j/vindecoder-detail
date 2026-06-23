import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
const dataFile = path.join(dataDir, 'data.json');

// Simple JSON-based database implementation
class SimpleDB {
  constructor() {
    this.users = [];
    this.vehicles = [];
    this.services = [];
    this.invoices = [];
    this.customers = [];
    this.businessSettings = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        this.users = data.users || [];
        this.vehicles = data.vehicles || [];
        this.services = data.services || [];
        this.invoices = data.invoices || [];
        this.customers = data.customers || [];
        this.businessSettings = data.businessSettings || {};
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
        users: this.users,
        vehicles: this.vehicles,
        services: this.services,
        invoices: this.invoices,
        customers: this.customers,
        businessSettings: this.businessSettings
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
          } else if (sql.includes('INSERT') && sql.includes('invoices')) {
            const id = Math.max(0, ...db.invoices.map(i => i.id)) + 1;
            const invoice = {
              id,
              invoiceNumber: params[0],
              customerId: params[1],
              vin: params[2],
              invoiceDate: params[3],
              serviceDate: params[4],
              subtotal: params[5],
              tax: params[6],
              discount: params[7],
              total: params[8],
              status: params[9] || 'pending',
              notes: params[10] || '',
              items: params[11] ? JSON.parse(params[11]) : [],
              createdAt: new Date().toISOString()
            };
            db.invoices.push(invoice);
            db.save();
            return { changes: 1, lastID: id };
          } else if (sql.includes('INSERT') && sql.includes('customers')) {
            const id = Math.max(0, ...db.customers.map(c => c.id)) + 1;
            const customer = {
              id,
              name: params[0],
              email: params[1],
              phone: params[2],
              address: params[3],
              city: params[4],
              state: params[5],
              zipCode: params[6],
              createdAt: new Date().toISOString()
            };
            db.customers.push(customer);
            db.save();
            return { changes: 1, lastID: id };
          } else if (sql.includes('UPDATE') && sql.includes('invoices')) {
            const id = params[params.length - 1];
            const invoice = db.invoices.find(i => i.id === id);
            if (invoice) {
              invoice.status = params[0];
              if (params.length > 2) invoice.notes = params[1];
              db.save();
            }
          } else if (sql.includes('UPDATE') && sql.includes('businessSettings')) {
            db.businessSettings = params[0];
            db.save();
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
            if (sql.includes('vehicles') && sql.includes('vin')) {
              return db.vehicles.find(v => v.vin === params[0]) || null;
            } else if (sql.includes('invoices') && sql.includes('id')) {
              return db.invoices.find(i => i.id === params[0]) || null;
            } else if (sql.includes('customers') && sql.includes('id')) {
              return db.customers.find(c => c.id === params[0]) || null;
            } else if (sql.includes('businessSettings')) {
              return Object.keys(db.businessSettings).length > 0 ? db.businessSettings : null;
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
          } else if (sql.includes('SELECT') && sql.includes('invoices')) {
            if (sql.includes('WHERE')) {
              const param = params[0];
              return db.invoices.filter(i => i.status === param).reverse();
            } else {
              const limit = params[0] || 100;
              const offset = params[1] || 0;
              return db.invoices.reverse().slice(offset, offset + limit);
            }
          } else if (sql.includes('SELECT') && sql.includes('customers')) {
            return db.customers;
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
      { id: 1, name: 'Paint Correction', description: 'Professional paint correction service', defaultPrice: 150 },
      { id: 2, name: 'Ceramic Coating', description: '2-year ceramic protective coating', defaultPrice: 500 },
      { id: 3, name: 'Interior Detailing', description: 'Complete interior vacuum, cleaning, and conditioning', defaultPrice: 200 },
      { id: 4, name: 'Exterior Wash', description: 'Full body wash, rinse, and dry', defaultPrice: 75 },
      { id: 5, name: 'Wax Application', description: 'Professional wax application for protection and shine', defaultPrice: 100 },
      { id: 6, name: 'Wheel & Tire Cleaning', description: 'Deep clean wheels and tires', defaultPrice: 60 },
      { id: 7, name: 'Windshield Treatment', description: 'Hydrophobic windshield treatment', defaultPrice: 40 }
    ];
    db.save();
  }

  // Initialize default business settings if empty
  if (Object.keys(db.businessSettings).length === 0) {
    db.businessSettings = {
      businessName: 'Your Detailing Business',
      address: '123 Main Street',
      city: 'Your City',
      state: 'State',
      zipCode: '12345',
      phone: '(555) 123-4567',
      email: 'info@yourdetailing.com',
      taxRate: 8,
      invoicePrefix: 'INV',
      paymentTerms: 14,
      currency: '$',
      logo: null
    };
    db.save();
  }

  console.log('Database initialized at', dataFile);
}

export default db;
