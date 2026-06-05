import axios from 'axios';
import Cookies from 'js-cookie'; // we’ll use the same token storage as your component

const api = axios.create({
  baseURL: 'http://localhost:5550/api', // 👈 notice /api added here
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token from cookie for every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response interceptor for JWT Expiry (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("JWT Expired. Redirecting to login...");
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
