import axios from 'axios';

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: add token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('spendigo_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('spendigo_token');
      localStorage.removeItem('spendigo_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: { email: string; username: string; password: string; full_name?: string }) =>
    api.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  getMe: () => api.get('/auth/me'),

  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    api.post('/auth/change-password', data),
};

// Transactions API
export interface ImportResult {
  success: boolean;
  total_rows: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; data: Record<string, string>; error: string }>;
}

export const transactionsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    type?: string;
    category?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get('/transactions', { params }),

  create: (data: {
    date: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    description?: string;
  }) => api.post('/transactions', data),

  update: (id: string, data: Partial<{
    date: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    description?: string;
  }>) => api.put(`/transactions/${id}`, data),

  delete: (id: string) => api.delete(`/transactions/${id}`),

  importCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ImportResult>('/transactions/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Analytics API
export const analyticsApi = {
  getSummary: (month?: string) =>
    api.get('/analytics/summary', { params: { month } }),

  getCategory: (params?: { month?: string; type?: string }) =>
    api.get('/analytics/category', { params }),

  getTrend: (days?: number) =>
    api.get('/analytics/trend', { params: { days } }),

  getSpendingDNA: () => api.get('/analytics/spending-dna'),

  getWeeklyWrapped: () => api.get('/analytics/weekly-wrapped'),
};

// Predict API
export interface WhatIfRequest {
  income_change?: number;
  expense_category_changes?: Record<string, number>;
  add_monthly_expense?: number;
}

export const predictApi = {
  getNextMonth: () => api.get('/predict/next-month'),
  getNextThreeMonths: () => api.get('/predict/next-three-months'),
  getInsights: (month?: string) => api.get('/predict/insights', { params: { month } }),
  getHealthScore: (month?: string) => api.get('/predict/health-score', { params: { month } }),
  getBrokeDate: () => api.get('/predict/broke-date'),
  simulateWhatIf: (data: WhatIfRequest) => api.post('/predict/what-if', data),
};

// Chat API
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ActionCard {
  type: 'add_transaction' | 'view_report' | 'save_transaction';
  label: string;
  data?: {
    amount?: number;
    type?: 'income' | 'expense';
    category?: string;
    description?: string;
  };
}

export interface ChatResponse {
  reply: string;
  suggested_actions: ActionCard[];
}

export const chatApi = {
  send: (message: string, history: ChatMessage[] = []) =>
    api.post<ChatResponse>('/chat', { message, history }),
};

// Budget Goals API
export const budgetApi = {
  getGoals: (month?: string) =>
    api.get('/budget', { params: { month } }),

  createGoal: (data: { category: string; budget_limit: number; month?: string }) =>
    api.post('/budget', data),

  updateGoal: (id: string, data: { budget_limit: number }) =>
    api.put(`/budget/${id}`, data),

  deleteGoal: (id: string) =>
    api.delete(`/budget/${id}`),
};

export default api;
