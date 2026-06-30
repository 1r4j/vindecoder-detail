import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  withCredentials: true // Send cookies with every request (for httpOnly auth cookies)
});

export const vehicleService = {
  decode: (vin) => api.post('/vehicles/decode', { vin }),
  getList: (limit = 100, offset = 0) => api.get('/vehicles/list', { params: { limit, offset } }),
  search: (query) => api.get('/vehicles/search', { params: { q: query } }),
  getByVin: (vin) => api.get(`/vehicles/${vin}`),
  updateColor: (vin, color) => api.patch(`/vehicles/${vin}/color`, { color })
};

export const invoiceService = {
  create: (invoiceData) => api.post('/invoices', invoiceData),
  getList: (limit = 100, offset = 0, status = null) =>
    api.get('/invoices', { params: { limit, offset, ...(status && { status }) } }),
  getById: (id) => api.get(`/invoices/${id}`),
  update: (id, data) => api.patch(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  search: (query) => api.get('/invoices/search', { params: { q: query } }),
  consolidate: (data) => api.post('/invoices/consolidate', data)
};

export const customerService = {
  create: (customerData) => api.post('/customers', customerData),
  getList: () => api.get('/customers'),
  getById: (id) => api.get(`/customers/${id}`),
  update: (id, data) => api.patch(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`)
};

export const settingsService = {
  get: () => api.get('/settings'),
  update: (settings) => api.patch('/settings', settings)
};

export const servicesService = {
  getList: () => api.get('/services')
};

export default api;
