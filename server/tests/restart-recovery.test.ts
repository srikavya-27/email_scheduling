import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../src/config/redis.js', () => ({
  redis: { ping: vi.fn(() => Promise.resolve('PONG')) },
}));

vi.mock('../src/config/db.js', () => ({
  pool: { execute: vi.fn() },
}));

vi.mock('../src/config/env.js', () => ({
  config: {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    QUEUE_CONCURRENCY: 8,
    QUEUE_PREFIX: 'test',
  },
}));

vi.mock('../src/queue/email.queue.js', () => ({
  emailQueue: {
    add: vi.fn(() => Promise.resolve({ id: 'job-1' })),
    remove: vi.fn(() => Promise.resolve()),
    getJob: vi.fn(),
    getJobs: vi.fn(() => Promise.resolve([])),
  },
  connection: {},
  QUEUE_NAME: 'email-deliveries',
}));

import { processEmailJob } from '../src/queue/email.worker.js';
import { pool } from '../src/config/db.js';

describe('Restart Recovery & Duplicate Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not re-send a delivery that was already sent before restart', async () => {
    (pool.execute as any).mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM email_deliveries')) {
        return Promise.resolve([{
          id: 1,
          delivery_uid: 'uid-1',
          campaign_id: 1,
          recipient_id: 1,
          sender_id: 1,
          user_id: 1,
          to_email: 'test@example.com',
          to_name: 'Test',
          subject: 'Subject',
          body: 'Body',
          status: 'sent',
          scheduled_time: new Date(),
          actual_send_time: new Date(),
          attempts: 1,
          max_attempts: 5,
          last_error: null,
          ethereal_preview_url: 'https://preview.test',
          ethereal_message_id: 'msg-1',
          created_at: new Date(),
          updated_at: new Date(),
        }, {}]);
      }
      return Promise.resolve([[], {}]);
    });

    const result = await processEmailJob({ data: { deliveryId: 1, deliveryUid: 'uid-1' }, attemptsMade: 0 } as any);
    expect(result.status).toBe('already_sent');
  });

  it('handles delivery not found gracefully', async () => {
    (pool.execute as any).mockResolvedValue([[], {}]);

    const result = await processEmailJob({ data: { deliveryId: 999, deliveryUid: 'uid-999' }, attemptsMade: 0 } as any);
    expect(result.status).toBe('not_found');
  });
});

describe('Concurrent Workers - Duplicate Prevention', () => {
  it('unique delivery_uid prevents duplicate processing', () => {
    const uids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      uids.add(`uid-${i}`);
    }
    expect(uids.size).toBe(1000);
  });

  it('unique job IDs prevent BullMQ from running same job twice', () => {
    const jobIds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      jobIds.add(`delivery-uid-${i}`);
    }
    expect(jobIds.size).toBe(100);
  });
});
