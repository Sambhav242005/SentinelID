import axios from 'axios';
import { User, Alias, BreachReport, Leak, IncidentCorrelation,
     AIClassification, PasswordBreachResponse } from './types';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post<{ message: string; user_id: string }>('/auth/login', { email, password });
    return response.data;
  },
  register: async (username: string, email: string, password: string) => {
    const response = await api.post<{ message: string; user_id: string }>('/auth/register', { username, email, password });
    return response.data;
  },
};

// Alias APIs
export const aliasApi = {
  getAliases: async (userId: string): Promise<Alias[]> => {
    const response = await api.get<Alias[]>(`/aliases?user_id=${userId}`);
    return response.data;
  },

  createAlias: async (data: {
    user_id: string;
    domain: string;
    site_name?: string;
    group_name?: string;
  }) => {
    // Your Flask POST returns the new alias with id, email, and password
    // Ensure your Alias type includes these
    const response = await api.post<Alias>('/aliases', data);
    return response.data;
  },

  // --- NEW ---
  updateAlias: async (
    aliasId: string,
    data: { site_name?: string; group_name?: string }
  ) => {
    // Your Flask PUT route returns a message and the ID
    // We'll just return the response, or void if we don't need the message
    const response = await api.put(`/aliases/${aliasId}`, data);
    return response.data; // Or just return void
  },

  // --- NEW ---
  deleteAlias: async (aliasId: string) => {
    // Your Flask DELETE route returns a message
    const response = await api.delete(`/aliases/${aliasId}`);
    return response.data; // Or just return void
  },
};
// Breach APIs
export const breachApi = {
  checkLeak: async (email: string, aliasId?: string): Promise<BreachReport> => {
    const response = await api.post<BreachReport>('/breach/leak-check', { email, alias_id: aliasId });
    return response.data;
  },
};

// Password APIs
export const passwordApi = {
  checkPassword: async (password: string): Promise<PasswordBreachResponse> => {
    const response = await api.post<PasswordBreachResponse>('/password/check-password', { password });
    return response.data;
  },
};

// Incident APIs
export const incidentApi = {
  correlateIncident: async (leakId: string) => {
    const response = await api.post('/incidents/correlate-incident', { leak_id: leakId });
    return response.data;
  },
  getCorrelations: async (leakId?: string, sessionId?: string): Promise<IncidentCorrelation[]> => {
    const params = new URLSearchParams();
    if (leakId) params.append('leak_id', leakId);
    if (sessionId) params.append('session_id', sessionId);
    const response = await api.get<IncidentCorrelation[]>(`/incidents/incident-correlations?${params}`);
    return response.data;
  },
  resolveCorrelation: async (correlationId: string, isResolved: boolean, notes?: string) => {
    const response = await api.put(`/incidents/incident-correlations/${correlationId}`, {
      is_resolved: isResolved,
      resolution_notes: notes,
    });
    return response.data;
  },
};

// AI APIs
export const aiApi = {
  monitorTabs: async (data: { url: string; actions: string[]; api_calls: string[] }): Promise<AIClassification> => {
    const response = await api.post<AIClassification>('/ai/agentic-monitor', data);
    return response.data;
  },
  sortEmail: async (emailContent: string) => {
    const response = await api.post('/ai/email-sort', { email_content: emailContent });
    return response.data;
  },
  getSummary: async (incidentDetails: string) => {
    const response = await api.post('/ai/incident-summary', { incident_details: incidentDetails });
    return response.data;
  },
  logChoice: async (data: { user_id: string; session_id: string; choice: string; features?: any }) => {
    const response = await api.post('/ai/log-choice', data);
    return response.data;
  },
};

export default api;