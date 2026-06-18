import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
});

export const vehicleService = {
  decode: (vin) => api.post('/vehicles/decode', { vin }),
  getList: (limit = 100, offset = 0) => api.get('/vehicles/list', { params: { limit, offset } }),
  search: (query) => api.get('/vehicles/search', { params: { q: query } }),
  getByVin: (vin) => api.get(`/vehicles/${vin}`),
  updateColor: (vin, color) => api.patch(`/vehicles/${vin}/color`, { color })
};

export const invoiceService = {
  create: (data) => api.post('/invoices', data),
  getById: (id) => api.get(`/invoices/${id}`),
  getList: (limit = 100, offset = 0) => api.get('/invoices', { params: { limit, offset } }),
  updateStatus: (id, status) => api.patch(`/invoices/${id}/status`, { status }),
  delete: (id) => api.delete(`/invoices/${id}`)
};

export const servicesService = {
  getServices: () => api.get('/services'),
  getBusinessConfig: () => api.get('/services/config/business'),
  updateBusinessConfig: (config) => api.put('/services/config/business', config)
};

export default api;
