import { randomUUID } from 'crypto';
import { pool } from '../config/db.js';
import { logger } from '../config/logger.js';
import { emailQueue } from '../queue/email.queue.js';
import type { RowDataPacket } from 'mysql2';

export interface CreateCampaignInput {
  userId: number;
  senderId: number;
  subject: string;
  body: string;
  startTime: Date;
  minDelaySec: number;
  hourlyLimit: number;
  recipients: { email: string; name: string }[];
}

export async function createCampaign(input: CreateCampaignInput): Promise<{ campaignId: number; deliveryCount: number }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [senders] = await conn.execute<RowDataPacket[]>(
      'SELECT * FROM sender_configs WHERE id = ? AND user_id = ? AND is_active = 1',
      [input.senderId, input.userId],
    );
    if (senders.length === 0) throw new Error('Sender not found or inactive');

    const sender = senders[0] as any;

    const [campResult] = await conn.execute(
      `INSERT INTO campaigns (user_id, sender_id, subject, body, start_time, min_delay_sec, hourly_limit, status, total_recipients)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
      [input.userId, input.senderId, input.subject, input.body, input.startTime, input.minDelaySec, input.hourlyLimit, input.recipients.length],
    );
    const campaignId = (campResult as any).insertId as number;

    const recipientValues: (string | number)[][] = [];
    for (const r of input.recipients) {
      recipientValues.push([campaignId, r.email, r.name]);
    }

    await conn.execute(
      'INSERT INTO recipients (campaign_id, email, name) VALUES ?',
      [recipientValues],
    );

    const [recipientRows] = await conn.execute<RowDataPacket[]>(
      'SELECT id, email, name FROM recipients WHERE campaign_id = ? ORDER BY id ASC',
      [campaignId],
    );

    const deliveryValues: (string | number | Date)[][] = [];
    for (let i = 0; i < recipientRows.length; i++) {
      const r = recipientRows[i] as any;
      const deliveryUid = randomUUID();
      const scheduledTime = new Date(input.startTime.getTime() + i * input.minDelaySec * 1000);
      deliveryValues.push([
        deliveryUid,
        campaignId,
        r.id,
        input.senderId,
        input.userId,
        r.email,
        r.name,
        input.subject,
        input.body,
        'scheduled',
        scheduledTime,
        5,
      ]);
    }

    await conn.execute(
      `INSERT INTO email_deliveries
       (delivery_uid, campaign_id, recipient_id, sender_id, user_id, to_email, to_name, subject, body, status, scheduled_time, max_attempts)
       VALUES ?`,
      [deliveryValues],
    );

    await conn.commit();

    const [deliveries] = await conn.execute<RowDataPacket[]>(
      'SELECT id, delivery_uid, scheduled_time FROM email_deliveries WHERE campaign_id = ? ORDER BY scheduled_time ASC',
      [campaignId],
    );

    for (const d of deliveries as any[]) {
      await emailQueue.add(
        'send-email',
        { deliveryId: d.id, deliveryUid: d.delivery_uid },
        {
          jobId: d.delivery_uid,
          delay: Math.max(0, d.scheduled_time.getTime() - Date.now()),
        },
      );
    }

    logger.info(`Campaign ${campaignId} created with ${deliveries.length} deliveries`);

    return { campaignId, deliveryCount: deliveries.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function cancelCampaign(userId: number, campaignId: number): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [camps] = await conn.execute<RowDataPacket[]>(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?',
      [campaignId, userId],
    );
    if (camps.length === 0) throw new Error('Campaign not found');

    const campaign = camps[0] as any;
    if (['completed', 'cancelled', 'failed'].includes(campaign.status)) {
      throw new Error('Cannot cancel a completed/failed campaign');
    }

    const [deliveries] = await conn.execute<RowDataPacket[]>(
      "SELECT delivery_uid, status FROM email_deliveries WHERE campaign_id = ? AND status IN ('scheduled','pending','rescheduled','queued')",
      [campaignId],
    );

    for (const d of deliveries as any[]) {
      await emailQueue.remove(d.delivery_uid).catch(() => {});
      await conn.execute(
        "UPDATE email_deliveries SET status = 'cancelled' WHERE delivery_uid = ?",
        [d.delivery_uid],
      );
    }

    await conn.execute(
      "UPDATE campaigns SET status = 'cancelled' WHERE id = ?",
      [campaignId],
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getCampaignStats(campaignId: number): Promise<{ sent: number; failed: number; pending: number }> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status IN ('scheduled','pending','rescheduled','queued') THEN 1 ELSE 0 END) AS pending
     FROM email_deliveries WHERE campaign_id = ?`,
    [campaignId],
  );
  return {
    sent: Number((rows[0] as any)?.sent || 0),
    failed: Number((rows[0] as any)?.failed || 0),
    pending: Number((rows[0] as any)?.pending || 0),
  };
}
