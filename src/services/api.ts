import type {
  DashboardStats,
  SenderConfig,
  Campaign,
  Delivery,
  PaginatedResult,
  ParseResult,
  SlackStatus,
} from '../types';

const API_BASE = '/api';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await resp.json().catch(() => null);

  if (!resp.ok) {
    const message = data?.error || `Request failed (${resp.status})`;
    throw new Error(message);
  }

  return data?.data as T;
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);

  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await resp.json().catch(() => null);

  if (!resp.ok) {
    throw new Error(data?.error || `Upload failed (${resp.status})`);
  }

  return data?.data as T;
}

export const api = {
  auth: {
    me: () => request<{ id: number; email: string; display_name: string; avatar_url: string }>('/auth/me'),
    logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  },

  dashboard: {
    stats: () => request<DashboardStats>('/dashboard/stats'),
    senders: () => request<SenderConfig[]>('/dashboard/senders'),
    updateSender: (id: number, data: Partial<SenderConfig>) =>
      request<{ message: string }>(`/dashboard/senders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  campaigns: {
    list: (page = 1, pageSize = 20) =>
      request<PaginatedResult<Campaign>>(`/campaigns?page=${page}&pageSize=${pageSize}`),
    get: (id: number) => request<Campaign & { sent: number; failed: number; pending: number }>(`/campaigns/${id}`),
    cancel: (id: number) => request<{ message: string }>(`/campaigns/${id}/cancel`, { method: 'POST' }),
    deliveries: (id: number, page = 1, pageSize = 50) =>
      request<PaginatedResult<Delivery>>(`/campaigns/${id}/deliveries?page=${page}&pageSize=${pageSize}`),
    parseRecipients: (file: File) => uploadFile<ParseResult>('/campaigns/parse-recipients', file),
    schedule: (data: {
      senderId: number;
      subject: string;
      body: string;
      startTime: string;
      minDelaySec: number;
      hourlyLimit: number;
      recipients: { email: string; name: string }[];
    }) => request<{ campaignId: number; deliveryCount: number }>('/campaigns/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  deliveries: {
    scheduled: (page = 1, pageSize = 50) =>
      request<PaginatedResult<Delivery>>(`/deliveries/scheduled?page=${page}&pageSize=${pageSize}`),
    sent: (page = 1, pageSize = 50) =>
      request<PaginatedResult<Delivery>>(`/deliveries/sent?page=${page}&pageSize=${pageSize}`),
  },

  search: {
    emails: (query: string, page = 1, pageSize = 20, status = 'all') =>
      request<PaginatedResult<Delivery>>(`/search/emails?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}&status=${status}`),
  },

  slack: {
    status: () => request<SlackStatus>('/slack/status'),
    connect: () => `${API_BASE}/slack/connect`,
    disconnect: () => request<{ message: string }>('/slack/disconnect', { method: 'POST' }),
    reconnect: () => `${API_BASE}/slack/reconnect`,
  },
};
