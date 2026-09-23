export interface AuthedUser {
  id: number;
  google_id: string;
  email: string;
  display_name: string;
  avatar_url: string;
}

export interface DashboardStats {
  totalCampaigns: number;
  totalEmails: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  scheduledCount: number;
  inProgressCount: number;
  successRate: number;
}

export interface Campaign {
  id: number;
  user_id: number;
  sender_id: number;
  subject: string;
  body: string;
  start_time: string;
  min_delay_sec: number;
  hourly_limit: number;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: number;
  delivery_uid: string;
  to_email: string;
  to_name: string;
  subject: string;
  status: string;
  scheduled_time?: string;
  actual_send_time?: string;
  campaign_id: number;
  attempts: number;
  last_error?: string;
  ethereal_preview_url?: string;
  ethereal_message_id?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ParseResult {
  recipients: { email: string; name: string }[];
  duplicates: number;
  invalid: number;
  total: number;
}

export interface SenderConfig {
  id: number;
  from_name: string;
  from_email: string;
  hourly_limit: number;
  min_delay_sec: number;
  is_active: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  teamId?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}
