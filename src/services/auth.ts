// Authentication service
const API_BASE_URL = 'http://localhost:8000/api';

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  last_login: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

// Auth API calls
export const authAPI = {
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    return response.json();
  },

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  },

  async getCurrentUser(token: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get user info');
    }

    return response.json();
  },
};

// Local storage helpers
export const authStorage = {
  setToken(token: string): void {
    localStorage.setItem('token', token);
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },

  setUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  clear(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

// Auth context helper
export const auth = {
  async register(data: RegisterData): Promise<void> {
    const response = await authAPI.register(data);
    authStorage.setToken(response.access_token);
    authStorage.setUser(response.user);
  },

  async login(data: LoginData): Promise<void> {
    const response = await authAPI.login(data);
    authStorage.setToken(response.access_token);
    authStorage.setUser(response.user);
  },

  logout(): void {
    authStorage.clear();
  },

  getCurrentUser(): User | null {
    return authStorage.getUser();
  },

  getToken(): string | null {
    return authStorage.getToken();
  },

  isAuthenticated(): boolean {
    return authStorage.isAuthenticated();
  },

  // Token doğrulama fonksiyonu - 401 hatası alırsa otomatik logout
  async validateToken(): Promise<boolean> {
    const token = authStorage.getToken();
    if (!token) {
      console.log('🔐 Token bulunamadı');
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        console.log('🔐 Token geçersiz, otomatik logout yapılıyor...');
        this.logout();
        return false;
      }

      if (!response.ok) {
        console.log('🔐 Backend hatası, token geçerli kabul ediliyor:', response.status);
        // Backend hatası varsa token'ı geçerli kabul et (login döngüsünü önlemek için)
        return true;
      }

      return true;
    } catch (error) {
      console.error('Token doğrulama hatası:', error);
      // Network hatası varsa token'ı geçerli kabul et
      console.log('🔐 Network hatası, token geçerli kabul ediliyor');
      return true;
    }
  },

  // API istekleri için güvenli fetch wrapper
  async secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = authStorage.getToken();
    
    if (!token) {
      this.logout();
      throw new Error('Token bulunamadı');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      console.log('🔐 API isteğinde 401 hatası, otomatik logout yapılıyor...');
      this.logout();
      window.location.href = '/login';
      throw new Error('Token geçersiz');
    }

    return response;
  },
};
