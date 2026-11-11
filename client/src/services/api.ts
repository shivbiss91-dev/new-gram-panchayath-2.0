import {
  ApiResponse,
  Complaint,
  ComplaintPriority,
  NotificationItem,
  PortalStats,
  AdminDashboardData,
  User,
} from '../types';
import { mockService } from './mockService';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';

/**
 * Smart fetch wrapper that:
 * 1. Automatically uses Mock Storage on GitHub Pages (static hosting without live backend)
 * 2. Talks to the live Node.js/Express backend on localhost or when VITE_API_URL is configured
 * 3. Gracefully falls back to mock demo data if the live server is unreachable or returns 404 HTML
 * 4. Completely prevents "Unexpected token '<' is not valid JSON" errors
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  mockFallback?: () => Promise<ApiResponse<T>>
): Promise<ApiResponse<T>> {
  // If hosted on GitHub Pages and no external cloud backend URL is set, use client-side mock store
  const isGitHubPages =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('github.io') &&
    !import.meta.env.VITE_API_URL;

  if (isGitHubPages && mockFallback) {
    try {
      return await mockFallback();
    } catch (err: any) {
      throw new Error(err.message || 'Operation failed');
    }
  }

  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Do not set Content-Type if body is FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: globalThis.Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkError: any) {
    // Backend is offline or unreachable -> smoothly fallback to mock store if provided
    if (mockFallback) {
      console.warn(`[Gram Panchayat Demo] API unreachable for ${endpoint} (${networkError.message}). Using demo store.`);
      return await mockFallback();
    }
    throw new Error(networkError.message || 'Network request failed. Please check your connection.');
  }

  const contentType = res.headers.get('content-type') || '';

  // If server returned non-JSON (e.g. static host HTML 404 or proxy ECONNREFUSED 500), fall back to mock store
  if (!contentType.includes('application/json')) {
    if (mockFallback) {
      console.warn(`[Gram Panchayat Demo] Server returned non-JSON for ${endpoint}. Using interactive demo store.`);
      return await mockFallback();
    }
    throw new Error(`Server returned unexpected response (${res.status}). Ensure the backend server is running.`);
  }

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401 && !endpoint.includes('/auth/login')) {
      localStorage.removeItem('token');
    }
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

// 1. Auth API
export const authApi = {
  register: (payload: any) =>
    request<{ token: string; user: User }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => mockService.register(payload)
    ),

  login: (payload: { identifier: string; password: string }) =>
    request<{ token: string; user: User }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => mockService.login(payload.identifier, payload.password)
    ),

  logout: () =>
    request(
      '/auth/logout',
      {
        method: 'POST',
      },
      async () => ({ success: true, message: 'Logged out successfully' })
    ),

  getProfile: () =>
    request<User>('/auth/me', {}, () => mockService.getProfile()),

  updateProfile: (payload: { name: string; email: string; mobile: string; address: string }) =>
    request<User>(
      '/auth/profile',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      () => mockService.updateProfile(payload)
    ),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request(
      '/auth/change-password',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      async () => ({ success: true, message: 'Password changed successfully' })
    ),
};

// 2. Public API
export const publicApi = {
  getStats: () =>
    request<PortalStats>('/public/stats', {}, () => mockService.getStats()),

  trackComplaint: (complaintNumber: string) =>
    request<Complaint>(
      `/public/track/${encodeURIComponent(complaintNumber)}`,
      {},
      () => mockService.trackComplaint(complaintNumber)
    ),
};

// 3. Citizen Complaints API
export const complaintApi = {
  getComplaints: (
    params: {
      search?: string;
      status?: string;
      priority?: string;
      category?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.priority) query.set('priority', params.priority);
    if (params.category) query.set('category', params.category);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    return request<Complaint[]>(
      `/complaints?${query.toString()}`,
      {},
      () => mockService.getComplaints(params)
    );
  },

  createComplaint: (formData: FormData) =>
    request<Complaint>(
      '/complaints',
      {
        method: 'POST',
        body: formData,
      },
      () => mockService.createComplaint(formData)
    ),

  getComplaintById: (id: string) =>
    request<Complaint>(
      `/complaints/${id}`,
      {},
      () => mockService.getComplaintById(id)
    ),

  submitFeedback: (id: string, payload: { rating: number; comment?: string }) =>
    request(
      `/complaints/${id}/feedback`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => mockService.submitFeedback(id, payload)
    ),
};

// 4. Admin API
export const adminApi = {
  getDashboard: () =>
    request<AdminDashboardData>(
      '/admin/dashboard',
      {},
      () => mockService.getAdminDashboard()
    ),

  getComplaints: (
    params: {
      search?: string;
      status?: string;
      priority?: string;
      category?: string;
      department?: string;
      dateRange?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== '') query.set(key, String(val));
    });

    return request<Complaint[]>(
      `/admin/complaints?${query.toString()}`,
      {},
      () => mockService.getAdminComplaints(params)
    );
  },

  getComplaintById: (id: string) =>
    request<Complaint>(
      `/admin/complaints/${id}`,
      {},
      () => mockService.getComplaintById(id)
    ),

  updatePriority: (id: string, payload: { priority: ComplaintPriority; remarks?: string }) =>
    request<Complaint>(
      `/admin/complaints/${id}/priority`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      () => mockService.updatePriority(id, payload)
    ),

  updateStatus: (
    id: string,
    payload: { status: string; priority?: ComplaintPriority; remarks?: string }
  ) =>
    request<Complaint>(
      `/admin/complaints/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      () => mockService.updateStatus(id, payload as any)
    ),

  assignComplaint: (
    id: string,
    payload: {
      assignedDepartment: string;
      assignedStaff: string;
      priority?: ComplaintPriority;
      remarks?: string;
    }
  ) =>
    request<Complaint>(
      `/admin/complaints/${id}/assign`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      () => mockService.assignComplaint(id, payload)
    ),

  getUsers: (params: { search?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    return request<any[]>(
      `/admin/users?${query.toString()}`,
      {},
      () => mockService.getUsers(params)
    );
  },

  getAnalytics: (timeRange = '30d') =>
    request<{
      categoryData: { category: string; count: number }[];
      statusData: { name: string; statusKey: string; value: number }[];
      priorityData: { priority: ComplaintPriority; name: string; count: number }[];
      trendData: { date: string; submitted: number; resolved: number }[];
      totalInRange: number;
    }>(
      `/admin/analytics?timeRange=${timeRange}`,
      {},
      () => mockService.getAnalytics(timeRange)
    ),

  getReports: (params: { category?: string; priority?: string; dateRange?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.priority) query.set('priority', params.priority);
    if (params.dateRange) query.set('dateRange', params.dateRange);

    return request<{
      total: number;
      resolved: number;
      assigned?: number;
      inProgress: number;
      pending: number;
      priorityCounts?: { HIGH: number; MEDIUM: number; LOW: number };
      resolutionRate: number;
      avgResolutionDays: number;
    }>(
      `/admin/reports?${query.toString()}`,
      {},
      () => mockService.getReports(params)
    );
  },

  exportCsvUrl: (
    params: {
      category?: string;
      status?: string;
      priority?: string;
      department?: string;
      search?: string;
      dateRange?: string;
    } = {}
  ) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== '') query.set(key, String(val));
    });
    return `${API_BASE}/admin/reports/export?${query.toString()}`;
  },

  exportCsv: async (
    params: {
      category?: string;
      status?: string;
      priority?: string;
      department?: string;
      search?: string;
      dateRange?: string;
    } = {}
  ) => {
    const triggerDownload = (csvText: string) => {
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gram_panchayat_complaints_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    const isGitHubPages =
      typeof window !== 'undefined' &&
      window.location.hostname.endsWith('github.io') &&
      !import.meta.env.VITE_API_URL;

    if (isGitHubPages) {
      const csvText = await mockService.exportCsv(params);
      triggerDownload(csvText);
      return;
    }

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = adminApi.exportCsvUrl(params);
    try {
      const res = await fetch(url, { headers });
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const errData = await res.json();
        throw new Error(errData.message || `Export failed (${res.status})`);
      }

      if (!res.ok) {
        if (contentType.includes('text/html') || res.status >= 500) {
          const csvText = await mockService.exportCsv(params);
          triggerDownload(csvText);
          return;
        }
        throw new Error(`Export failed (${res.status})`);
      }

      if (contentType.includes('text/html')) {
        const csvText = await mockService.exportCsv(params);
        triggerDownload(csvText);
        return;
      }

      const csvText = await res.text();
      triggerDownload(csvText);
    } catch (err: any) {
      if (err instanceof TypeError) {
        const csvText = await mockService.exportCsv(params);
        triggerDownload(csvText);
        return;
      }
      throw err;
    }
  },
};

// 5. Notifications API
export const notificationApi = {
  getAll: () =>
    request<NotificationItem[]>(
      '/notifications',
      {},
      () => mockService.getNotifications()
    ),

  markRead: (id: string) =>
    request(
      `/notifications/${id}/read`,
      {
        method: 'PATCH',
      },
      () => mockService.markNotificationRead(id)
    ),

  markAllRead: () =>
    request(
      '/notifications/read-all',
      {
        method: 'PATCH',
      },
      () => mockService.markAllNotificationsRead()
    ),
};
