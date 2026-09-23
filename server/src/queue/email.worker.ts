import { Worker, type Job } from 'bullmq';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { connection, QUEUE_NAME, type EmailJobData } from './email.queue.js';
import { getDeliveryById, markDeliverySent, markDeliveryFailed } from '../services/delivery.service.js';
import { getSenderConfig, acquireSendSlot } from '../services/rate-limiter.service.js';
import { sendEmail } from '../services/smtp.service.js';
import { emailQueue } from './email.queue.js';
import { notifyHourlyLimitHit } from '../services/slack.service.js';
import { pool } from '../config/db.js';
import type { EmailDeliveryRow } from '../types/index.js';

async function rescheduleDelivery(delivery: EmailDeliveryRow, nextTime: Date, reason: string): Promise<void> {
  await pool.execute(
    `UPDATE email_deliveries SET status = 'rescheduled', scheduled_time = ?, last_error = ? WHERE id = ?`,
    [nextTime, `Rescheduled: ${reason}`, delivery.id],
  );

  await emailQueue.add(
    'send-email',
    { deliveryId: delivery.id, deliveryUid: delivery.delivery_uid } satisfies EmailJobData,
    {
      jobId: `${delivery.delivery_uid}:reschedule:${nextTime.getTime()}`,
      delay: Math.max(0, nextTime.getTime() - Date.now()),
    },
  );
  logger.info(`Delivery ${delivery.delivery_uid} rescheduled to ${nextTime.toISOString()} (${reason})`);
}

export async function processEmailJob(job: Job<EmailJobData>): Promise<{ status: string }> {
  const { deliveryId, deliveryUid } = job.data;
  logger.info(`Processing job ${job.id} for delivery ${deliveryUid} (attempt ${job.attemptsMade + 1})`);

  const delivery = await getDeliveryById(deliveryId);
  if (!delivery) {
    logger.warn(`Delivery ${deliveryId} not found, skipping`);
    return { status: 'not_found' };
  }

  if (delivery.status === 'sent') {
    logger.info(`Delivery ${deliveryUid} already sent, skipping (idempotent)`);
    return { status: 'already_sent' };
  }

  if (delivery.status === 'cancelled') {
    logger.info(`Delivery ${deliveryUid} cancelled, skipping`);
    return { status: 'cancelled' };
  }

  const sender = await getSenderConfig(delivery.sender_id);
  if (!sender) {
    await markDeliveryFailed(deliveryId, 'Sender not found or inactive');
    throw new Error('Sender not found');
  }

  const rateCheck = await acquireSendSlot(sender.id, sender.hourly_limit, sender.min_delay_sec);
  if (!rateCheck.allowed) {
    if (rateCheck.reason === 'hourly_limit') {
      logger.info(`Hourly limit reached for sender ${sender.id}, rescheduling delivery ${deliveryUid}`);
      await rescheduleDelivery(delivery, rateCheck.nextAvailableTime, 'hourly_limit');
      await notifyHourlyLimitHit(sender.id, sender.from_name || sender.from_email).catch((err) =>
        logger.warn(`Slack notification failed: ${err}`),
      );
      return { status: 'rescheduled' };
    } else {
      logger.info(`Min delay not met for sender ${sender.id}, rescheduling delivery ${deliveryUid}`);
      await rescheduleDelivery(delivery, rateCheck.nextAvailableTime, 'min_delay');
      return { status: 'rescheduled' };
    }
  }

  await pool.execute(
    "UPDATE email_deliveries SET status = 'in_progress', attempts = attempts + 1 WHERE id = ?",
    [deliveryId],
  );

  try {
    const result = await sendEmail({
      fromName: sender.from_name,
      fromEmail: sender.from_email,
      toEmail: delivery.to_email,
      toName: delivery.to_name,
      subject: delivery.subject,
      body: delivery.body,
    });

    await markDeliverySent(deliveryId, result.messageId, result.previewUrl);
    return { status: 'sent' };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`SMTP send failed for delivery ${deliveryUid}: ${errorMsg}`);

    if (job.attemptsMade + 1 < delivery.max_attempts) {
      await pool.execute(
        "UPDATE email_deliveries SET status = 'queued', last_error = ? WHERE id = ?",
        [errorMsg, deliveryId],
      );
      throw err;
    }

    await markDeliveryFailed(deliveryId, errorMsg);
    return { status: 'failed' };
  }
}

export function startWorker(): Worker {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAME,
    processEmailJob,
    {
      connection,
      concurrency: config.QUEUE_CONCURRENCY,
      prefix: config.QUEUE_PREFIX,
    },
  );

  worker.on('ready', () => logger.info(`BullMQ worker started with concurrency ${config.QUEUE_CONCURRENCY}`));
  worker.on('error', (err) => logger.error('Worker error', err));
  worker.on('failed', (job, err) => {
    if (job) logger.error(`Job ${job.id} failed permanently: ${err.message}`);
  });

  return worker;
}
