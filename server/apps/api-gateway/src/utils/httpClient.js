const axios = require('axios');

function createAxiosInstance({ baseURL, timeout }) {
  const instance = axios.create({
    baseURL,
    timeout,
  });

  // request interceptor to allow adding tracing headers etc.
  instance.interceptors.request.use(config => {
    if (!config.headers['X-Request-Id'] && config.headers['x-request-id']) {
      config.headers['X-Request-Id'] = config.headers['x-request-id'];
    }
    return config;
  });

  // basic response interceptor to normalize errors
  instance.interceptors.response.use(
    r => r,
    err => {
      // wrap axios error for controller to handle
      const e = new Error(err.message);
      e.status = err.response ? err.response.status : 502;
      e.data = err.response ? err.response.data : null;
      throw e;
    }
  );

  return instance;
}

module.exports = { createAxiosInstance };
