import axios from 'axios';
import mapConfig from '../config/mapConfig';

const { geocodingBase, key } = mapConfig;

const createClient = () => {
  const instance = axios.create({
    baseURL: geocodingBase,
    params: {
      key,
    },
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        const details = error.response.data?.message || error.response.statusText;
        // eslint-disable-next-line no-console
        console.error('[maptiler] request failed:', details);
      }
      return Promise.reject(error);
    },
  );

  return instance;
};

const client = createClient();

export const searchAddress = async (query, params = {}) => {
  if (!query) {
    throw new Error('query is required for geocoding');
  }
  const requestParams = {
    ...params,
    key,
  };
  const { data } = await client.get(`/${encodeURIComponent(query)}.json`, {
    params: requestParams,
  });
  return data;
};

export const reverseGeocode = async (longitude, latitude, params = {}) => {
  if (longitude === undefined || latitude === undefined) {
    throw new Error('longitude and latitude are required for reverse geocoding');
  }
  const requestParams = {
    ...params,
    key,
  };
  const { data } = await client.get(`${longitude},${latitude}.json`, {
    params: requestParams,
  });
  return data;
};

export const getMapStyleUrl = () => mapConfig.styleUrl;

export default {
  searchAddress,
  reverseGeocode,
  getMapStyleUrl,
};
