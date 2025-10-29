import axios from 'axios';
import api from './api';

const directBaseURL = import.meta.env.VITE_PRODUCT_SERVICE_URL;
const directClient = directBaseURL
  ? axios.create({
      baseURL: directBaseURL,
      timeout: 8000,
    })
  : null;

let lastCatalogKey = null;
let lastCatalogPromise = null;

function buildKey(params = {}) {
  try {
    return JSON.stringify(params, Object.keys(params).sort());
  } catch (error) {
    return null;
  }
}

async function requestCatalog(params = {}) {
  const key = buildKey(params);
  if (key && lastCatalogPromise && key === lastCatalogKey) {
    return lastCatalogPromise;
  }

  const performRequest = async () => {
    try {
      const response = await api.get('/api/restaurants/catalog', { params });
      return response.data;
    } catch (error) {
      if (!directClient) throw error;
      const response = await directClient.get('/api/restaurants/catalog', { params });
      return response.data;
    }
  };

  const pending = performRequest()
    .then((result) => {
      if (key === lastCatalogKey) {
        lastCatalogPromise = Promise.resolve(result);
      }
      return result;
    })
    .catch((error) => {
      if (key === lastCatalogKey) {
        lastCatalogPromise = null;
      }
      throw error;
    });

  if (key) {
    lastCatalogKey = key;
    lastCatalogPromise = pending;
  }

  return pending;
}

function adaptCatalogRestaurant(entry) {
  if (!entry) return null;
  if (!entry.restaurant || typeof entry.restaurant !== 'object') {
    return entry;
  }
  return {
    ...entry.restaurant,
    categories: Array.isArray(entry.categories) ? entry.categories : [],
    products: Array.isArray(entry.products) ? entry.products : [],
    combos: Array.isArray(entry.combos) ? entry.combos : [],
    branches: Array.isArray(entry.branches) ? entry.branches : [],
    catalog: entry,
  };
}

export async function fetchCatalog(params = {}) {
  return requestCatalog(params);
}

export async function fetchRestaurants(params = {}) {
  const catalog = await requestCatalog(params);
  if (!Array.isArray(catalog?.restaurants)) return [];
  return catalog.restaurants.map(adaptCatalogRestaurant).filter(Boolean);
}

export async function fetchProducts(params = {}) {
  const catalog = await requestCatalog(params);
  return Array.isArray(catalog?.products) ? catalog.products : [];
}

const catalogService = { fetchCatalog, fetchRestaurants, fetchProducts };

export default catalogService;
