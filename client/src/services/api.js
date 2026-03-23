import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const login = (email, password) => api.post('/users/login', { email, password });
export const register = (data) => api.post('/users/register', data);
export const joinHousehold = (data) => api.post('/users/join', data);
export const createInvite = (data) => api.post('/users/invite', data);
export const createAdvisorInvite = (data) => api.post('/users/invite-advisor', data);
export const getHousehold = () => api.get('/users/household');
export const getMe = () => api.get('/users/me');
export const getUsers = () => api.get('/users');

// Household settings
export const updateHouseholdSettings = (data) => api.put('/users/household/settings', data);

// User profile
export const updateProfile = (data) => api.put('/users/profile', data);

// Accounts
export const getAccounts = (owner) => api.get('/accounts', { params: { owner } });
export const createAccount = (data) => api.post('/accounts', data);
export const updateAccount = (id, data) => api.put(`/accounts/${id}`, data);
export const deleteAccount = (id) => api.delete(`/accounts/${id}`);

// Transactions
export const getTransactions = (filters) => api.get('/transactions', { params: filters });
export const getSummary = (params) => api.get('/transactions/summary', { params });
export const getOverallBalance = (params) => api.get('/transactions/overall-balance', { params });
export const getMonthlyTrend = (params) => api.get('/transactions/monthly-trend', { params });
export const getCategoryDetails = (params) => api.get('/transactions/category-details', { params });
export const createTransaction = (data) => api.post('/transactions', data);
export const bulkImport = (transactions) => api.post('/transactions/bulk', { transactions });
export const updateTransaction = (id, data) => api.put(`/transactions/${id}`, data);
export const deleteTransaction = (id) => api.delete(`/transactions/${id}`);

// Reports
export const getMonthlyReport = (params) => api.get('/reports/monthly', { params });
export const getByPersonReport = (params) => api.get('/reports/by-person', { params });
export const getByCardReport = (params) => api.get('/reports/by-card', { params });
export const getTopMerchants = (params) => api.get('/reports/top-merchants', { params });
export const getSavingsRate = (params) => api.get('/reports/savings-rate', { params });
export const getCashFlow = (params) => api.get('/reports/cash-flow', { params });
export const getYearOverYear = (params) => api.get('/reports/year-over-year', { params });
export const getCategoryDetailReport = (params) => api.get('/reports/category-detail', { params });

// Import
export const importCSV = (data) => api.post('/import/csv', data);
export const getImportStatus = (params) => api.get('/import/status', { params });

// Balances & Assets
export const getBalances = () => api.get('/balances');
export const saveBalances = (accounts) => api.put('/balances', { accounts });

// Subscription
export const createCheckoutSession = (data) => api.post('/subscription/create-checkout', data);
export const getSubscriptionStatus = () => api.get('/subscription/status');

export default api;
