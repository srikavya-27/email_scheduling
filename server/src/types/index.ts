export type DeliveryStatus =
  | 'pending'
  | 'queued'
  | 'scheduled'
  | 'in_progress'
  | 'sent'
  | 'failed'
  | 'rescheduled'
  | 'cancelled';

export type CampaignStatus =
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface UserRow {
  id: number;
  google_id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  created_at: Date;
  updated_at: Date;
}

export interface SenderConfigRow {
  id: number;
  user_id: number;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  ethereal_user: string;
  ethereal_pass: string;
  ethereal_smtp_url: string;
  hourly_limit: number;
  min_delay_sec: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignRow {
  id: number;
  user_id: number;
  sender_id: number;
  subject: string;
  body: string;
  start_time: Date;
  min_delay_sec: number;
  hourly_limit: number;
  status: CampaignStatus;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface RecipientRow {
  id: number;
  campaign_id: number;
  email: string;
  name: string;
  created_at: Date;
}

export interface EmailDeliveryRow {
  id: number;
  delivery_uid: string;
  campaign_id: number;
  recipient_id: number;
  sender_id: number;
  user_id: number;
  to_email: string;
  to_name: string;
  subject: string;
  body: string;
  status: DeliveryStatus;
  scheduled_time: Date;
  actual_send_time: Date | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  ethereal_preview_url: string;
  ethereal_message_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface SlackIntegrationRow {
  id: number;
  user_id: number;
  team_id: string;
  team_name: string;
  bot_user_id: string;
  access_token: string;
  scopes: string;
  webhook_url: string;
  is_connected: number;
  created_at: Date;
  updated_at: Date;
}

export interface RateLimitEventRow {
  id: number;
  sender_id: number;
  event_type: 'send' | 'reschedule' | 'hourly_limit_hit';
  window_key: string;
  created_at: Date;
}

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

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
