
async function ensureFetch() {
  if (typeof fetch === 'function') {
    return fetch;
  }
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch;
}

async function httpRequest(url, options = {}) {
  const fetchFn = await ensureFetch();
  const controller = new AbortController();
  const timeoutMs = options.timeout ?? options.timeoutMs ?? 5000;
  const timer =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetchFn(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error = new Error(`Request failed with status ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

module.exports = {
  httpRequest,
};
