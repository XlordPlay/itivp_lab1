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

const data = (request) => request.then((response) => response.data);

export const login = (email, password) => data(api.post('/auth/login', { email, password }));
export const register = (email, password) => data(api.post('/auth/register', { email, password }));

// MongoDB: операции, вложенные позиции и теги
export const fetchCategories = () => data(api.get('/mongo/categories'));
export const fetchStats = (month, signal) => data(api.get('/mongo/stats', { params: { month }, signal }));
export const fetchTransactions = (params, signal) => data(api.get('/mongo/transactions', { params, signal }));
export const addTransaction = (item) => data(api.post('/mongo/transactions', item));
export const updateTransaction = (id, item) => data(api.put(`/mongo/transactions/${id}`, item));
export const deleteTransaction = (id) => data(api.delete(`/mongo/transactions/${id}`));
export const addItem = (id, item) => data(api.post(`/mongo/transactions/${id}/items`, item));
export const changeItem = (id, itemId, body) => data(api.patch(`/mongo/transactions/${id}/items/${itemId}`, body));
export const removeItem = (id, itemId) => data(api.delete(`/mongo/transactions/${id}/items/${itemId}`));

export const fetchAccounts = (signal) => data(api.get('/mongo/accounts', { signal }));
export const addAccount = (account) => data(api.post('/mongo/accounts', account));
export const updateAccount = (id, account) => data(api.put(`/mongo/accounts/${id}`, account));
export const deleteAccount = (id) => data(api.delete(`/mongo/accounts/${id}`));

export const fetchBudget = (month, signal) => data(api.get(`/mongo/budgets/${month}`, { signal }));
export const setLimit = (month, category, limit) =>
  data(api.patch(`/mongo/budgets/${month}/limits/${encodeURIComponent(category)}`, { limit }));
export const deleteLimit = (month, category) =>
  data(api.delete(`/mongo/budgets/${month}/limits/${encodeURIComponent(category)}`));

// ИИ-ассистент
export const fetchAiStatus = () => data(api.get('/ai/status'));
export const askAssistant = (messages) => data(api.post('/ai/chat', { messages }));

export const isCanceled = (error) => axios.isCancel(error);

// Текст ошибки для пользователя: ответ сервера, сеть или что-то еще
export function getErrorMessage(error) {
  if (error.response) {
    return error.response.data?.error || `Ошибка сервера (${error.response.status})`;
  }
  if (error.request) return 'Сервер недоступен. Проверьте, что API запущен';
  return error.message;
}
