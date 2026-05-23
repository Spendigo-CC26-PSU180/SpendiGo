export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  created_at: string;
}

export const auth = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('spendigo_token');
  },

  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('spendigo_token', token);
  },

  removeToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('spendigo_token');
  },

  getUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('spendigo_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser: (user: User): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('spendigo_user', JSON.stringify(user));
  },

  removeUser: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('spendigo_user');
  },

  isAuthenticated: (): boolean => {
    return !!auth.getToken();
  },

  logout: (): void => {
    auth.removeToken();
    auth.removeUser();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  login: (token: string, user: User): void => {
    auth.setToken(token);
    auth.setUser(user);
  },
};

export default auth;
