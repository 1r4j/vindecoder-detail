import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

export default api;
