const axios = require('axios');
const config = require('../config');

const client = axios.create({
  baseURL: config.productServiceUrl,
  timeout: config.httpTimeout,
});

async function fetchBranchById(branchId) {
  if (!branchId) return null;
  try {
    const response = await client.get(`/api/restaurants/branches/by-id/${branchId}`, {
      validateStatus: () => true,
    });
    if (response.status === 404) {
      return null;
    }
    if (response.status >= 200 && response.status < 300) {
      return response.data || null;
    }
    throw new Error(
      response.data?.error ||
        response.data?.message ||
        `product-service branch lookup failed (${response.status})`,
    );
  } catch (error) {
    if (error.response) {
      const err = new Error(
        error.response.data?.error ||
          error.response.data?.message ||
          'product-service branch lookup failed',
      );
      err.status = error.response.status;
      err.data = error.response.data;
      throw err;
    }
    throw error;
  }
}

module.exports = {
  fetchBranchById,
};
