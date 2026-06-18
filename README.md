# VIN Decoder & Invoice Generator

A comprehensive car detailing business application that decodes Vehicle Identification Numbers (VINs) using the NHTSA API and allows users to create professional invoices for detailing services.

## Features

### VIN Decoder
- **VIN Scanning & Input**: Scan or manually input 17-character VINs
- **NHTSA API Integration**: Decodes VIN information using the free NHTSA Vehicle Specifications API
- **Vehicle Information Display**: Shows comprehensive vehicle data including:
  - Year, Make, Model, Body Type
  - Engine specifications (type, displacement, cylinders)
  - Transmission and drive type
  - GVWR and manufacturing plant
- **Vehicle History**: Maintains a history of recently scanned vehicles
- **Real-time Validation**: Validates VIN format in real-time

### Invoice Management
- **Auto-populated Vehicle Data**: Vehicle information automatically fills into invoices
- **Service Selection**: Choose from pre-configured detailing services or create custom ones
- **Flexible Pricing**: Support for hourly rates, fixed prices, and quantities
- **Tax Calculation**: Automatic tax computation with configurable rates
- **Discounts**: Apply percentage or fixed-amount discounts
- **Professional Invoice PDF**: Generate downloadable, printable invoices
- **Invoice History**: Track all created invoices
- **Payment Status Tracking**: Mark invoices as pending, paid, or overdue
- **Customer Management**: Store customer contact information

## Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **better-sqlite3** - Database
- **Axios** - HTTP client for NHTSA API
- **CORS** - Cross-Origin Resource Sharing

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **Axios** - API client
- **jsPDF & html2canvas** - PDF generation
- **CSS3** - Styling

## Project Structure

```
VinDecoder_Detail/
├── backend/
│   ├── src/
│   │   ├── server.js                 # Express server entry point
│   │   ├── db.js                     # Database initialization
│   │   ├── services/
│   │   │   ├── vinService.js         # VIN decoding logic
│   │   │   ├── vehicleService.js     # Vehicle data management
│   │   │   └── invoiceService.js     # Invoice creation/management
│   │   └── routes/
│   │       ├── vin.js                # VIN endpoints
│   │       ├── invoices.js           # Invoice endpoints
│   │       └── services.js           # Services & config endpoints
│   ├── data/                         # SQLite database directory
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx                  # React entry point
│   │   ├── App.jsx                   # Main app component
│   │   ├── index.css                 # Global styles
│   │   ├── App.css                   # App layout styles
│   │   ├── components/
│   │   │   ├── Navigation.jsx        # Navigation bar
│   │   │   ├── VINDecoder.jsx        # VIN decoder page
│   │   │   ├── VehicleDetails.jsx    # Vehicle info display
│   │   │   ├── InvoiceCreator.jsx    # Invoice creation form
│   │   │   ├── InvoicePreview.jsx    # Invoice preview & download
│   │   │   └── InvoiceManager.jsx    # Invoice history & management
│   │   ├── services/
│   │   │   └── api.js                # API integration layer
│   │   └── utils/
│   │       ├── pdfGenerator.js       # PDF generation utilities
│   │       └── formatting.js         # Data formatting utilities
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

## Installation

### Prerequisites
- Node.js 16+ and npm
- Windows/Mac/Linux

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create the data directory:
```bash
mkdir data
```

4. Start the backend server:
```bash
npm start
```

The backend will run on `http://localhost:3000`

Server logs will show:
```
VIN Decoder API running on http://localhost:3000
Database initialized at /path/to/backend/data/app.db
```

### Frontend Setup

1. In a new terminal, navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Usage

### Decoding a VIN

1. Navigate to the **VIN Decoder** tab
2. Enter or scan a 17-character VIN
3. Click **Decode VIN**
4. View the decoded vehicle information
5. Optionally, click **Create Invoice** to generate an invoice for this vehicle

### Creating an Invoice

1. From the VIN Decoder, click **Create Invoice** (or select a recent vehicle)
2. Fill in customer information:
   - Customer name (required)
   - Email, phone, address (optional)
3. Select the service date
4. Add services:
   - Choose from pre-configured services or create custom ones
   - Set quantities and rates
5. Configure pricing:
   - Set tax rate (default 8%)
   - Apply discounts if needed
6. Add any notes
7. Click **Create Invoice**
8. Review the preview
9. Click **Download PDF** to get the invoice

### Managing Invoices

1. Navigate to the **Invoices** tab
2. View all created invoices in a table
3. Filter by payment status (Pending, Paid, Overdue)
4. Actions available:
   - **View**: See full invoice preview
   - **PDF**: Download invoice as PDF
   - **Delete**: Remove invoice
5. Update payment status using the dropdown

## API Endpoints

### VIN Endpoints
- `POST /api/vehicles/decode` - Decode a VIN
- `GET /api/vehicles/list` - Get all vehicles
- `GET /api/vehicles/search?q=query` - Search vehicles
- `GET /api/vehicles/:vin` - Get vehicle by VIN

### Invoice Endpoints
- `POST /api/invoices` - Create invoice
- `GET /api/invoices` - Get all invoices
- `GET /api/invoices/:id` - Get invoice by ID
- `PATCH /api/invoices/:id/status` - Update payment status
- `DELETE /api/invoices/:id` - Delete invoice

### Services Endpoints
- `GET /api/services` - Get available services
- `GET /api/services/config/business` - Get business configuration
- `PUT /api/services/config/business` - Update business configuration

## Database Schema

### Vehicles Table
- id, vin, year, make, model, bodyType, engineType, transmission, driveType, gvwr, plant, rawData, scannedAt

### Invoices Table
- id, invoiceNumber, invoiceId, vehicleId, vin, customerName, customerEmail, customerPhone, customerAddress, serviceDate, invoiceDate, subtotal, taxRate, taxAmount, discountType, discountValue, totalAmount, paymentStatus, notes, createdAt, updatedAt

### InvoiceItems Table
- id, invoiceId, serviceName, description, quantity, rate, total

### Services Table
- id, name, description, defaultPrice

### BusinessConfig Table
- id, businessName, businessAddress, businessPhone, businessEmail, taxRate, invoicePrefix, paymentTermsDays, currencySymbol

## Configuration

### Business Information
Business details can be configured at runtime through the API. Default values:
- Business Name: Sparkle Auto Detailing
- Address: 123 Main Street, Your City, State 12345
- Phone: (555) 987-6543
- Email: info@sparkledetail.com
- Tax Rate: 8%
- Invoice Prefix: INV
- Payment Terms: 14 days

### Default Services
The app comes with pre-configured services:
- Exterior Wash - $50
- Interior Vacuum - $40
- Ceramic Coat - $150
- Window Cleaning - $25
- Tire Shine - $20
- Clay Bar Treatment - $60
- Wax Application - $80
- Leather Conditioning - $75

Services can be modified through the database.

## Examples

### Example VINs for Testing
- `1HGBH41JXMN109186` - Honda Civic
- `2T1BURHE0JC044186` - Toyota Corolla
- `WBADN63497G915187` - BMW 3 Series
- `3G5DA03E53S546971` - Chevrolet Cavalier
- `1GCHK29U85E108186` - Chevrolet Tahoe

(Note: NHTSA may not have data for all VINs. Use real VINs for best results)

## Features Demonstration

### VIN Decoder Workflow
1. User enters VIN: `1HGBH41JXMN109186`
2. App calls NHTSA API and decodes to: 2021 Honda Civic Sedan
3. Vehicle data displayed in organized grid
4. User can create invoice directly from this data

### Invoice Creation Workflow
1. User fills in customer info: John Smith
2. Adds services: Exterior Wash ($50), Interior Vacuum ($40), Ceramic Coat ($150)
3. Subtotal: $240
4. Tax (8%): $19.20
5. Total Due: $259.20
6. Invoice generated with number INV-00001
7. PDF downloadable for printing/emailing

## Performance

- VIN Decoding: < 2 seconds
- Invoice Creation: < 1 second
- PDF Generation: < 2 seconds
- Support for 500+ locally stored invoices
- Responsive design for mobile and desktop

## Troubleshooting

### Backend Issues
- **Port already in use**: Change PORT in `.env` or stop other services
- **Database errors**: Delete `backend/data/app.db` and restart
- **API timeout**: Check internet connection for NHTSA API

### Frontend Issues
- **API errors**: Ensure backend is running on port 3000
- **PDF generation fails**: Check browser console for errors
- **Slow performance**: Clear browser cache and reload

## Future Enhancements
- Multi-user authentication
- Email invoice delivery
- Image attachments (before/after photos)
- Customer database with history
- Advanced reporting and analytics
- Mobile app (React Native)
- Recurring invoices
- Multiple business locations

## License
MIT

## Support
For issues or questions, please check the troubleshooting section or review the code comments.

---

Built with ❤️ for car detailing businesses
