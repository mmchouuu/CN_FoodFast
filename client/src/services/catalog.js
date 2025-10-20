import axios from 'axios';
import api from './api';

const directBaseURL = import.meta.env.VITE_PRODUCT_SERVICE_URL;
const directClient = directBaseURL
  ? axios.create({
      baseURL: directBaseURL,
      timeout: 8000,
    })
  : null;

function unwrapData(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchThroughGateway(path, params) {
  const { data } = await api.get(path, { params });
  return unwrapData(data);
}

async function fetchDirectly(path, params) {
  if (!directClient) {
    throw new Error('No direct product service URL configured');
  }
  const { data } = await directClient.get(path, { params });
  return unwrapData(data);
}

export async function fetchRestaurants(params = {}) {
  const query = { ...params };
  if (!query.include) {
    query.include = 'branches,menu';
  }
  try {
    return await fetchThroughGateway('/api/restaurants', query);
  } catch (error) {
    if (!directClient) throw error;
    try {
      return await fetchDirectly('/api/restaurants', query);
    } catch (directError) {
      throw directError;
    }
  }
}

export async function fetchProducts(params = {}) {
  try {
    return await fetchThroughGateway('/api/products', params);
  } catch (error) {
    if (!directClient) throw error;
    try {
      return await fetchDirectly('/api/products', params);
    } catch (directError) {
      throw directError;
    }
  }
}

const catalogService = { fetchRestaurants, fetchProducts };

export default catalogService;

