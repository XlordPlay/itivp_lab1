import axios from 'axios';

export const LOGOUT_EVENT = 'auth:logout';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Каждый запрос получает JWT из localStorage
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Искусственная задержка, чтобы увидеть состояния загрузки (VITE_API_DELAY в .env)
  const delay = Number(import.meta.env.VITE_API_DELAY) || 0;
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  return config;
});

// Токен истек или неверный: выходим из аккаунта
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event(LOGOUT_EVENT));
    }
    return Promise.reject(error);
  },
);

export const login = (email, password) => api.post('/auth/login', { email, password });

export const fetchCategories = () => api.get('/categories');

export const fetchTransactions = (search, signal) =>
  api.get('/transactions', { params: search ? { search } : {}, signal });

export const addTransaction = (item) => api.post('/transactions', item);
export const updateTransaction = (id, item) => api.put(`/transactions/${id}`, item);
export const deleteTransaction = (id) => api.delete(`/transactions/${id}`);

export const isCanceled = (error) => axios.isCancel(error);

// Текст ошибки для пользователя: ответ сервера, сеть или что-то еще
export function getErrorMessage(error) {
  if (error.response) {
    return error.response.data?.error || `Ошибка сервера (${error.response.status})`;
  }
  if (error.request) return 'Сервер недоступен. Проверьте, что API запущен';
  return error.message;
}
