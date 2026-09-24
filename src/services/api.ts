import { supabase } from '../lib/supabase';
import type {
  DashboardStats,
  SenderConfig,
  Campaign,
  Delivery,
  PaginatedResult,
  ParseResult,
  SlackStatus,
} from '../types';

function parseRecipientsFile(content: string, filename: string): ParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const recipients: { email: string; name: string }[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let invalid = 0;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const line of lines) {
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    let email = '';
    let name = '';

    if (parts.length >= 2) {
      email = parts.find((p) => emailRegex.test(p)) || parts[0];
      const emailIdx = parts.indexOf(email);
      name = parts.filter((_, i) => i !== emailIdx).join(' ');
    } else {
      email = parts[0];
    }

    if (!emailRegex.test(email)) {
      invalid++;
      continue;
    }

    const key = email.toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    recipients.push({ email, name });
  }

  return {
    recipients,
    duplicates,
    invalid,
    total: recipients.length,
  };
}

export const api = {
  auth: {
    me: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();
      return {
        id: session.user.id,
        email: session.user.email || '',
        display_name: profile?.display_name || session.user.email || '',
        avatar_url: profile?.avatar_url || '',
      };
    },
    logout: async () => {
      await supabase.auth.signOut();
      return { message: 'Logged out' };
    },
  },

  dashboard: {
    stats: async (): Promise<DashboardStats> => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { count: campaignCount } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { data: deliveries } = await supabase
        .from('email_deliveries')
        .select('status')
        .eq('user_id', userId);

      const deliveryRows = deliveries || [];
      const total = deliveryRows.length;
      const sentCount = deliveryRows.filter((d) => d.status === 'sent').length;
      const failedCount = deliveryRows.filter((d) => d.status === 'failed').length;
      const pendingCount = deliveryRows.filter((d) => d.status === 'pending').length;
      const scheduledCount = deliveryRows.filter((d) => d.status === 'scheduled').length;
      const inProgressCount = deliveryRows.filter((d) => d.status === 'in_progress').length;

      const totalAttempted = sentCount + failedCount;
      const successRate = totalAttempted > 0 ? Math.round((sentCount / totalAttempted) * 1000) / 10 : 0;

      return {
        totalCampaigns: campaignCount || 0,
        totalEmails: total,
        sentCount,
        failedCount,
        pendingCount,
        scheduledCount,
        inProgressCount,
        successRate,
      };
    },

    senders: async (): Promise<SenderConfig[]> => {
      const { data, error } = await supabase
        .from('sender_configs')
        .select('id, from_name, from_email, hourly_limit, min_delay_sec, is_active')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []) as SenderConfig[];
    },

    updateSender: async (id: string, data: Partial<SenderConfig>) => {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.from_name !== undefined) update.from_name = data.from_name;
      if (data.from_email !== undefined) update.from_email = data.from_email;
      if (data.hourly_limit !== undefined) update.hourly_limit = data.hourly_limit;
      if (data.min_delay_sec !== undefined) update.min_delay_sec = data.min_delay_sec;

      const { error } = await supabase
        .from('sender_configs')
        .update(update)
        .eq('id', id);
      if (error) throw new Error(error.message);
      return { message: 'Sender updated' };
    },
  },

  campaigns: {
    list: async (page = 1, pageSize = 20): Promise<PaginatedResult<Campaign>> => {
      const { data, error, count } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      const total = count || 0;
      return {
        data: (data || []) as Campaign[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },

    get: async (id: string): Promise<Campaign> => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Campaign not found');
      return data as Campaign;
    },

    cancel: async (id: string) => {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .in('status', ['pending', 'scheduled', 'in_progress']);
      if (error) throw new Error(error.message);
      return { message: 'Campaign cancelled' };
    },

    deliveries: async (id: string, page = 1, pageSize = 50): Promise<PaginatedResult<Delivery>> => {
      const { data, error, count } = await supabase
        .from('email_deliveries')
        .select('id, delivery_uid, to_email, to_name, subject, status, scheduled_time, actual_send_time, attempts, last_error, ethereal_preview_url, campaign_id', { count: 'exact' })
        .eq('campaign_id', id)
        .order('scheduled_time', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      const total = count || 0;
      return {
        data: (data || []) as Delivery[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },

    parseRecipients: async (file: File): Promise<ParseResult> => {
      const text = await file.text();
      return parseRecipientsFile(text, file.name);
    },

    schedule: async (data: {
      senderId: string;
      subject: string;
      body: string;
      startTime: string;
      minDelaySec: number;
      hourlyLimit: number;
      recipients: { email: string; name: string }[];
    }): Promise<{ campaignId: string; deliveryCount: number }> => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { data: campaign, error: campErr } = await supabase
        .from('campaigns')
        .insert({
          user_id: userId,
          sender_id: data.senderId,
          subject: data.subject,
          body: data.body,
          start_time: data.startTime,
          min_delay_sec: data.minDelaySec,
          hourly_limit: data.hourlyLimit,
          status: 'scheduled',
          total_recipients: data.recipients.length,
        })
        .select('id')
        .single();
      if (campErr) throw new Error(campErr.message);

      const campaignId = campaign.id;

      const recipientRows = data.recipients.map((r) => ({
        campaign_id: campaignId,
        email: r.email,
        name: r.name || '',
      }));

      const { data: insertedRecipients, error: recipErr } = await supabase
        .from('recipients')
        .insert(recipientRows)
        .select('id, email, name');
      if (recipErr) throw new Error(recipErr.message);

      const startDate = new Date(data.startTime);
      const deliveries = (insertedRecipients || []).map((r, i) => ({
        campaign_id: campaignId,
        recipient_id: r.id,
        sender_id: data.senderId,
        user_id: userId,
        to_email: r.email,
        to_name: r.name || '',
        subject: data.subject,
        body: data.body,
        status: 'scheduled',
        scheduled_time: new Date(startDate.getTime() + i * data.minDelaySec * 1000).toISOString(),
      }));

      const { error: delErr } = await supabase
        .from('email_deliveries')
        .insert(deliveries);
      if (delErr) throw new Error(delErr.message);

      return { campaignId, deliveryCount: deliveries.length };
    },
  },

  deliveries: {
    scheduled: async (page = 1, pageSize = 50): Promise<PaginatedResult<Delivery>> => {
      const { data, error, count } = await supabase
        .from('email_deliveries')
        .select('id, delivery_uid, to_email, to_name, subject, status, scheduled_time, campaign_id, attempts', { count: 'exact' })
        .in('status', ['scheduled', 'pending', 'rescheduled', 'queued'])
        .order('scheduled_time', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      const total = count || 0;
      return {
        data: (data || []) as Delivery[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },

    sent: async (page = 1, pageSize = 50): Promise<PaginatedResult<Delivery>> => {
      const { data, error, count } = await supabase
        .from('email_deliveries')
        .select('id, delivery_uid, to_email, to_name, subject, status, actual_send_time, campaign_id, attempts, last_error, ethereal_preview_url, ethereal_message_id', { count: 'exact' })
        .in('status', ['sent', 'failed'])
        .order('actual_send_time', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      const total = count || 0;
      return {
        data: (data || []) as Delivery[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  },

  search: {
    emails: async (query: string, page = 1, pageSize = 20, status = 'all'): Promise<PaginatedResult<Delivery>> => {
      let q = supabase
        .from('email_deliveries')
        .select('id, delivery_uid, to_email, to_name, subject, status, scheduled_time, actual_send_time, campaign_id, attempts, last_error, ethereal_preview_url', { count: 'exact' });

      if (status !== 'all') {
        q = q.eq('status', status);
      }
      q = q.or(`to_email.ilike.%${query}%,subject.ilike.%${query}%`);
      q = q.order('scheduled_time', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      const total = count || 0;
      return {
        data: (data || []) as Delivery[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  },

  slack: {
    status: async (): Promise<SlackStatus> => {
      const { data, error } = await supabase
        .from('slack_integrations')
        .select('team_id, team_name, is_connected')
        .maybeSingle();
      if (error) return { connected: false };
      if (!data) return { connected: false };
      return {
        connected: data.is_connected,
        teamName: data.team_name,
        teamId: data.team_id,
      };
    },
    connect: () => '',
    disconnect: async () => {
      const { error } = await supabase
        .from('slack_integrations')
        .delete()
        .neq('team_id', '___never___');
      if (error) throw new Error(error.message);
      return { message: 'Slack disconnected' };
    },
    reconnect: () => '',
  },
};
