const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

let memoryToken = null;
let isRefreshing = false;
let refreshSubscribers = [];
let onTokenUpdate = null;

export const setAuthToken = (token) => {
  memoryToken = token;
};

export const getAuthToken = () => {
  return memoryToken;
};

export const registerTokenListener = (fn) => {
  onTokenUpdate = fn;
};

const onRefreshed = (token) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback) => {
  refreshSubscribers.push(callback);
};

export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (memoryToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${memoryToken}`;
  }

  const config = {
    ...options,
    headers,
    credentials: 'include' // Send cookies for refresh token
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    const error = new Error('Network error. Please check your connection.');
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  // Handle 401 and try refresh if this isn't already a login/refresh request
  const isAuthRoute = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh') || endpoint.includes('/auth/register');

  if (response.status === 401 && !isAuthRoute && !options._retry) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include'
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newToken = refreshData.data?.accessToken;
          setAuthToken(newToken);
          if (onTokenUpdate) {
            onTokenUpdate(newToken, refreshData.data?.user);
          }
          onRefreshed(newToken);
        } else {
          setAuthToken(null);
          if (onTokenUpdate) {
            onTokenUpdate(null, null);
          }
          onRefreshed(null);
        }
      } catch (err) {
        setAuthToken(null);
        if (onTokenUpdate) {
          onTokenUpdate(null, null);
        }
        onRefreshed(null);
      } finally {
        isRefreshing = false;
      }
    }

    // Wait for the refresh promise
    return new Promise((resolve, reject) => {
      addRefreshSubscriber(async (newToken) => {
        if (!newToken) {
          const error = new Error('Session expired. Please log in again.');
          error.code = 'UNAUTHENTICATED';
          error.status = 401;
          return reject(error);
        }
        try {
          const retryOptions = {
            ...options,
            _retry: true,
            headers: {
              ...(options.headers || {}),
              Authorization: `Bearer ${newToken}`
            }
          };
          const retryResponse = await apiFetch(endpoint, retryOptions);
          resolve(retryResponse);
        } catch (retryError) {
          reject(retryError);
        }
      });
    });
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = data?.error?.code || data?.code || 'API_ERROR';
    error.details = data?.error?.details || data?.details || null;
    throw error;
  }

  return data;
}

export const api = {
  get: (endpoint, options) => apiFetch(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => apiFetch(endpoint, { method: 'POST', body, ...options }),
  patch: (endpoint, body, options) => apiFetch(endpoint, { method: 'PATCH', body, ...options }),
  delete: (endpoint, options) => apiFetch(endpoint, { method: 'DELETE', ...options })
};

export default api;
