import axios from 'axios';

const baseURL = import.meta.env.VITE_PRODUCT_SERVICE_URL || 'http://localhost:3002';

const catalogApi = axios.create({
  baseURL,
  timeout: 8000,
});

export async function fetchRestaurants(params = {}) {
  const { data } = await catalogApi.get('/api/restaurants', { params });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function fetchProducts(params = {}) {
  const { data } = await catalogApi.get('/api/products', { params });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

const catalogService = { fetchRestaurants, fetchProducts };

export default catalogService;

