import { pool } from '../config/db.js';
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';
import { redis } from '../config/redis.js';
import type { RowDataPacket } from 'mysql2';
import { currentHourKey, recordHourlyLimitEvent } from './rate-limiter.service.js';

export async function getSlackIntegration(userId: number): Promise<any | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM slack_integrations WHERE user_id = ? AND is_connected = 1 ORDER BY id DESC LIMIT 1',
    [userId],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function saveSlackIntegration(
  userId: number,
  data: {
    team_id: string;
    team_name: string;
    bot_user_id: string;
    access_token: string;
    scopes: string;
    webhook_url: string;
  },
): Promise<void> {
  await pool.execute(
    `INSERT INTO slack_integrations (user_id, team_id, team_name, bot_user_id, access_token, scopes, webhook_url, is_connected)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE team_name = ?, bot_user_id = ?, access_token = ?, scopes = ?, webhook_url = ?, is_connected = 1`,
    [userId, data.team_id, data.team_name, data.bot_user_id, data.access_token, data.scopes, data.webhook_url,
     data.team_name, data.bot_user_id, data.access_token, data.scopes, data.webhook_url],
  );
}

export async function disconnectSlack(userId: number): Promise<void> {
  await pool.execute(
    'UPDATE slack_integrations SET is_connected = 0 WHERE user_id = ?',
    [userId],
  );
}

export async function exchangeSlackCode(code: string): Promise<any> {
  const params = new URLSearchParams({
    client_id: config.SLACK_CLIENT_ID,
    client_secret: config.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: config.SLACK_REDIRECT_URI,
  });

  const resp = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!resp.ok) {
    throw new Error(`Slack OAuth HTTP error: ${resp.status}`);
  }

  const data: any = await resp.json();
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`);
  }
  return data;
}

export async function postSlackMessage(accessToken: string, channel: string, text: string): Promise<void> {
  const resp = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text }),
  });

  if (!resp.ok) {
    logger.error(`Slack postMessage HTTP error: ${resp.status}`);
    return;
  }

  const data: any = await resp.json();
  if (!data.ok) {
    logger.error(`Slack postMessage error: ${data.error}`);
  }
}

export async function notifyHourlyLimitHit(senderId: number, senderName: string): Promise<void> {
  const hourKey = currentHourKey(senderId);
  const notifKey = `eos:slack:notif:${senderId}:${hourKey}`;
  const lockSet = await redis.set(notifKey, '1', 'EX', 3700, 'NX');
  if (lockSet !== 'OK') {
    logger.debug(`Slack notification already sent for sender ${senderId} window ${hourKey}`);
    return;
  }

  await pool.execute(
    'INSERT INTO slack_notifications (sender_id, window_key) VALUES (?, ?) ON DUPLICATE KEY UPDATE notified_at = notified_at',
    [senderId, hourKey],
  );

  const [senders] = await pool.execute<RowDataPacket[]>(
    'SELECT user_id FROM sender_configs WHERE id = ?',
    [senderId],
  );
  if (senders.length === 0) return;

  const userId = (senders[0] as any).user_id;
  const slack = await getSlackIntegration(userId);
  if (!slack) {
    logger.info(`No Slack integration for user ${userId}, skipping hourly limit notification`);
    return;
  }

  const message = `:hourglass: Sender "${senderName}" (ID: ${senderId}) has reached its hourly email limit. Pending emails are being rescheduled to the next available window.`;
  await postSlackMessage(slack.access_token, slack.bot_user_id || '#general', message);
  await recordHourlyLimitEvent(senderId);
}
