import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

export const connection = new IORedis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

export const QUEUE_NAME = 'email-deliveries';

export const emailQueue = new Queue(
  QUEUE_NAME,
  { connection, prefix: config.QUEUE_PREFIX },
);

export const queueEvents = new QueueEvents(QUEUE_NAME, { connection, prefix: config.QUEUE_PREFIX });

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Job ${jobId} failed: ${failedReason}`);
});

queueEvents.on('completed', ({ jobId }) => {
  logger.debug(`Job ${jobId} completed`);
});

export interface EmailJobData {
  deliveryId: number;
  deliveryUid: string;
}
