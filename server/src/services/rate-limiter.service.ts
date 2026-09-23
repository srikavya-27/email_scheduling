import { redis } from '../config/redis.js';
import { pool } from '../config/db.js';
import { logger } from '../config/logger.js';
import type { RowDataPacket } from 'mysql2';

export interface RateCheckResult {
  allowed: boolean;
  nextAvailableTime: Date;
  reason: string;
}

function currentHourKey(senderId: number): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  return `eos:rate:${senderId}:${y}${m}${d}${h}`;
}

function nextHourStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + 1);
  return d;
}

export async function getSenderConfig(senderId: number): Promise<any | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM sender_configs WHERE id = ? AND is_active = 1',
    [senderId],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function checkMinimumDelay(senderId: number, minDelaySec: number): Promise<boolean> {
  const key = `eos:delay:${senderId}`;
  const lastSendTs = await redis.get(key);
  if (!lastSendTs) return true;
  const elapsed = (Date.now() - parseInt(lastSendTs, 10)) / 1000;
  return elapsed >= minDelaySec;
}

export async function acquireSendSlot(
  senderId: number,
  hourlyLimit: number,
  minDelaySec: number,
): Promise<RateCheckResult> {
  const delayKey = `eos:delay:${senderId}`;
  const hourKey = currentHourKey(senderId);

  const now = Date.now();
  const lastSendTs = await redis.get(delayKey);
  if (lastSendTs) {
    const elapsed = (now - parseInt(lastSendTs, 10)) / 1000;
    if (elapsed < minDelaySec) {
      const waitMs = (minDelaySec - elapsed) * 1000;
      return {
        allowed: false,
        nextAvailableTime: new Date(now + waitMs),
        reason: 'min_delay',
      };
    }
  }

  const hourCount = await redis.incr(hourKey);
  if (hourCount === 1) {
    await redis.expire(hourKey, 3700);
  }

  if (hourCount > hourlyLimit) {
    await redis.decr(hourKey);
    const nextTime = nextHourStart(new Date());
    return {
      allowed: false,
      nextAvailableTime: nextTime,
      reason: 'hourly_limit',
    };
  }

  await redis.set(delayKey, String(now), 'PX', minDelaySec * 2 * 1000);

  await pool.execute(
    'INSERT INTO rate_limit_events (sender_id, event_type, window_key) VALUES (?, ?, ?)',
    [senderId, 'send', hourKey],
  );

  return { allowed: true, nextAvailableTime: new Date(now), reason: 'ok' };
}

export async function recordHourlyLimitEvent(senderId: number): Promise<void> {
  const hourKey = currentHourKey(senderId);
  await pool.execute(
    'INSERT INTO rate_limit_events (sender_id, event_type, window_key) VALUES (?, ?, ?)',
    [senderId, 'hourly_limit_hit', hourKey],
  );
}

export async function getCurrentHourCount(senderId: number): Promise<number> {
  const hourKey = currentHourKey(senderId);
  const count = await redis.get(hourKey);
  return count ? parseInt(count, 10) : 0;
}

export { currentHourKey, nextHourStart };
