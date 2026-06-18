# API Reference

Base URL: `http://localhost:3000/api`

## Vehicle Endpoints

### Decode VIN
Decodes a VIN and returns vehicle information from NHTSA database.

**Endpoint**: `POST /vehicles/decode`

**Request**:
```json
{
  "vin": "1HGBH41JXMN109186"
}
```

**Response** (Success):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "vin": "1HGBH41JXMN109186",
    "year": 2021,
    "make": "Honda",
    "model": "Civic",
    "bodyType": "Sedan",
    "engineType": "V-4 cyl",
    "transmission": "Automatic",
    "driveType": "FWD",
    "gvwr": "4700 lbs",
    "plant": "Suzuka, Japan",
    "scannedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response** (Error):
```json
{
  "error": "Invalid VIN format. VINs must be exactly 17 characters."
}
```

---

### List Vehicles
Get paginated list of all scanned vehicles.

**Endpoint**: `GET /vehicles/list`

**Query Parameters**:
- `limit` (optional, default: 100) - Number of records to return
- `offset` (optional, default: 0) - Pagination offset

**Example**: `GET /vehicles/list?limit=20&offset=0`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "vin": "1HGBH41JXMN109186",
      "year": 2021,
      "make": "Honda",
      "model": "Civic",
      ...
    }
  ]
}
```

---

### Search Vehicles
Search vehicles by VIN, make, or model.

**Endpoint**: `GET /vehicles/search`

**Query Parameters**:
- `q` (required) - Search query (min 2 characters)

**Example**: `GET /vehicles/search?q=Honda`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "vin": "1HGBH41JXMN109186",
      "year": 2021,
      "make": "Honda",
      "model": "Civic",
      ...
    }
  ]
}
```

---

### Get Vehicle by VIN
Get a specific vehicle by its VIN.

**Endpoint**: `GET /vehicles/:vin`

**Example**: `GET /vehicles/1HGBH41JXMN109186`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "vin": "1HGBH41JXMN109186",
    "year": 2021,
    "make": "Honda",
    "model": "Civic",
    ...
  }
}
```

---

## Invoice Endpoints

### Create Invoice
Creates a new invoice.

**Endpoint**: `POST /invoices`

**Request**:
```json
{
  "vehicleId": 1,
  "vin": "1HGBH41JXMN109186",
  "customerName": "John Smith",
  "customerEmail": "john@example.com",
  "customerPhone": "(555) 123-4567",
  "customerAddress": "123 Main St, City, State 12345",
  "serviceDate": "2024-01-15",
  "items": [
    {
      "serviceName": "Exterior Wash",
      "description": "Full body wash, rinse, dry",
      "quantity": 1,
      "rate": 50.00,
      "total": 50.00
    },
    {
      "serviceName": "Interior Vacuum",
      "description": "Seats, floor, trunk",
      "quantity": 1,
      "rate": 40.00,
      "total": 40.00
    }
  ],
  "taxRate": 0.08,
  "discountType": "none",
  "discountValue": 0,
  "notes": "Customer requested extra care on leather seats"
}
```

**Response** (Success):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "invoiceNumber": "INV-00001",
    "invoiceId": "ID-1234567890-abc123def",
    "vehicleId": 1,
    "vin": "1HGBH41JXMN109186",
    "customerName": "John Smith",
    "customerEmail": "john@example.com",
    "customerPhone": "(555) 123-4567",
    "customerAddress": "123 Main St, City, State 12345",
    "serviceDate": "2024-01-15",
    "invoiceDate": "2024-01-15",
    "subtotal": 90.00,
    "taxRate": 0.08,
    "taxAmount": 7.20,
    "discountType": "none",
    "discountValue": 0,
    "totalAmount": 97.20,
    "paymentStatus": "pending",
    "notes": "Customer requested extra care on leather seats",
    "items": [
      {
        "id": 1,
        "invoiceId": 1,
        "serviceName": "Exterior Wash",
        "description": "Full body wash, rinse, dry",
        "quantity": 1,
        "rate": 50.00,
        "total": 50.00
      },
      {
        "id": 2,
        "invoiceId": 1,
        "serviceName": "Interior Vacuum",
        "description": "Seats, floor, trunk",
        "quantity": 1,
        "rate": 40.00,
        "total": 40.00
      }
    ]
  }
}
```

---

### Get Invoice by ID
Get a specific invoice.

**Endpoint**: `GET /invoices/:id`

**Example**: `GET /invoices/1`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "invoiceNumber": "INV-00001",
    ...
    "items": [...]
  }
}
```

---

### List All Invoices
Get paginated list of all invoices.

**Endpoint**: `GET /invoices`

**Query Parameters**:
- `limit` (optional, default: 100) - Number of records to return
- `offset` (optional, default: 0) - Pagination offset

**Example**: `GET /invoices?limit=10&offset=0`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "invoiceNumber": "INV-00001",
      ...
    }
  ]
}
```

---

### Update Invoice Payment Status
Update the payment status of an invoice.

**Endpoint**: `PATCH /invoices/:id/status`

**Request**:
```json
{
  "status": "paid"
}
```

**Valid Status Values**: `pending`, `paid`, `overdue`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "invoiceNumber": "INV-00001",
    "paymentStatus": "paid",
    ...
  }
}
```

---

### Delete Invoice
Delete an invoice and all its items.

**Endpoint**: `DELETE /invoices/:id`

**Example**: `DELETE /invoices/1`

**Response**:
```json
{
  "success": true,
  "message": "Invoice deleted successfully"
}
```

---

## Services Endpoints

### Get Available Services
Get list of all available detailing services.

**Endpoint**: `GET /services`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Exterior Wash",
      "description": "Full body wash, rinse, dry",
      "defaultPrice": 50.00
    },
    {
      "id": 2,
      "name": "Interior Vacuum",
      "description": "Seats, floor, trunk",
      "defaultPrice": 40.00
    }
  ]
}
```

---

### Get Business Configuration
Get current business settings and information.

**Endpoint**: `GET /services/config/business`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "businessName": "Sparkle Auto Detailing",
    "businessAddress": "123 Main Street, Your City, State 12345",
    "businessPhone": "(555) 987-6543",
    "businessEmail": "info@sparkledetail.com",
    "taxRate": 0.08,
    "invoicePrefix": "INV",
    "paymentTermsDays": 14,
    "currencySymbol": "$"
  }
}
```

---

### Update Business Configuration
Update business settings and information.

**Endpoint**: `PUT /services/config/business`

**Request**:
```json
{
  "businessName": "Premium Auto Detailing",
  "businessAddress": "456 Oak Ave, New City, State 54321",
  "businessPhone": "(555) 987-6544",
  "businessEmail": "hello@premiumdetail.com",
  "taxRate": 0.09,
  "invoicePrefix": "INV",
  "paymentTermsDays": 30,
  "currencySymbol": "$"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "businessName": "Premium Auto Detailing",
    ...
  }
}
```

---

## Health Check

### API Health Status
Check if the API is running and healthy.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Bad request - invalid parameters or missing required fields |
| 404 | Not found - resource doesn't exist |
| 500 | Server error - something went wrong on the server |

### Example Error Response:
```json
{
  "error": "Invalid VIN format. VINs must be exactly 17 characters."
}
```

---

## Usage Examples

### Example 1: Complete Invoice Workflow

1. **Decode a VIN**:
```bash
curl -X POST http://localhost:3000/api/vehicles/decode \
  -H "Content-Type: application/json" \
  -d '{"vin":"1HGBH41JXMN109186"}'
```

2. **Create an Invoice**:
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": 1,
    "vin": "1HGBH41JXMN109186",
    "customerName": "John Smith",
    "customerEmail": "john@example.com",
    "items": [
      {
        "serviceName": "Exterior Wash",
        "quantity": 1,
        "rate": 50.00,
        "total": 50.00
      }
    ],
    "taxRate": 0.08
  }'
```

3. **Get the Invoice**:
```bash
curl http://localhost:3000/api/invoices/1
```

4. **Mark as Paid**:
```bash
curl -X PATCH http://localhost:3000/api/invoices/1/status \
  -H "Content-Type: application/json" \
  -d '{"status":"paid"}'
```

### Example 2: Search and Get Vehicle Details

```bash
# Search for Honda vehicles
curl "http://localhost:3000/api/vehicles/search?q=Honda"

# Get specific vehicle
curl "http://localhost:3000/api/vehicles/1HGBH41JXMN109186"
```

---

## Rate Limiting & Performance

- API requests: No rate limiting (configurable if needed)
- Database: SQLite, supports 500+ invoices without performance issues
- VIN decoding: Relies on NHTSA API (may have occasional timeouts)
- PDF generation: Handled by frontend (jsPDF)

---

## Authentication

Currently, no authentication is implemented. For production use, consider adding:
- JWT tokens
- API key management
- User authentication
- Role-based access control

See README.md for future enhancements.
