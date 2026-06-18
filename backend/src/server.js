import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db.js';

import vinRoutes from './routes/vin.js';
import invoiceRoutes from './routes/invoices.js';
import servicesRoutes from './routes/services.js';

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initializeDatabase();

app.use('/api/vehicles', vinRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/services', servicesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`VIN Decoder API running on http://localhost:${PORT}`);
  console.log(`Database initialized at ${path.join(__dirname, '../data/app.db')}`);
});
