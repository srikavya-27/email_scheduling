import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/env.js', () => ({
  config: {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    QUEUE_CONCURRENCY: 8,
    QUEUE_PREFIX: 'test',
    NODE_ENV: 'test',
  },
}));

const mockStore: Record<string, string> = {};

vi.mock('../src/config/redis.js', () => ({
  redis: {
    get: vi.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    set: vi.fn((key: string, val: string, ...opts: any[]) => {
      const hasNX = opts.includes('NX');
      if (hasNX && mockStore[key] !== undefined) return Promise.resolve(null);
      mockStore[key] = val;
      return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => { delete mockStore[key]; return Promise.resolve(1); }),
    incr: vi.fn((key: string) => { mockStore[key] = String((parseInt(mockStore[key] || '0', 10)) + 1); return Promise.resolve(parseInt(mockStore[key], 10)); }),
    decr: vi.fn((key: string) => { mockStore[key] = String((parseInt(mockStore[key] || '0', 10)) - 1); return Promise.resolve(parseInt(mockStore[key], 10)); }),
    expire: vi.fn(() => Promise.resolve(1)),
    ping: vi.fn(() => Promise.resolve('PONG')),
  },
}));

vi.mock('../src/config/db.js', () => ({
  pool: { execute: vi.fn(() => Promise.resolve([[], {}])) },
}));

vi.mock('../src/config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../src/services/elasticsearch.service.js', () => ({
  esClient: {},
  ensureEsIndex: vi.fn(),
  indexDelivery: vi.fn(() => Promise.resolve()),
  searchDeliveries: vi.fn(),
}));

vi.mock('../src/services/slack.service.js', () => ({
  notifyHourlyLimitHit: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/services/smtp.service.js', () => ({
  sendEmail: vi.fn(() => Promise.resolve({ messageId: 'test-id', previewUrl: 'https://preview.test' })),
  createTransport: vi.fn(),
}));

vi.mock('../src/queue/email.queue.js', () => ({
  emailQueue: {
    add: vi.fn(() => Promise.resolve({ id: 'test-job' })),
    remove: vi.fn(() => Promise.resolve()),
  },
  connection: {},
  QUEUE_NAME: 'email-deliveries',
}));

import { processEmailJob } from '../src/queue/email.worker.js';
import { pool } from '../src/config/db.js';
import { sendEmail } from '../src/services/smtp.service.js';
import { emailQueue } from '../src/queue/email.queue.js';
import { redis } from '../src/config/redis.js';

function mockDelivery(overrides: any = {}) {
  return {
    id: 1,
    delivery_uid: 'test-uid-1',
    campaign_id: 1,
    recipient_id: 1,
    sender_id: 1,
    user_id: 1,
    to_email: 'recipient@test.com',
    to_name: 'Test User',
    subject: 'Test Subject',
    body: 'Test Body',
    status: 'scheduled',
    scheduled_time: new Date(),
    actual_send_time: null,
    attempts: 0,
    max_attempts: 5,
    last_error: null,
    ethereal_preview_url: '',
    ethereal_message_id: '',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function mockSender(overrides: any = {}) {
  return {
    id: 1,
    user_id: 1,
    from_name: 'Test Sender',
    from_email: 'sender@test.com',
    reply_to: null,
    ethereal_user: '',
    ethereal_pass: '',
    ethereal_smtp_url: '',
    hourly_limit: 50,
    min_delay_sec: 60,
    is_active: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('Email Worker - processEmailJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockStore)) delete mockStore[key];
  });

  it('skips delivery that is already sent (idempotency)', async () => {
    (pool.execute as any).mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM email_deliveries')) {
        return Promise.resolve([mockDelivery({ status: 'sent' }), {}]);
      }
      return Promise.resolve([[], {}]);
    });

    const result = await processEmailJob({ data: { deliveryId: 1, deliveryUid: 'test-uid-1' }, attemptsMade: 0 } as any);
    expect(result.status).toBe('already_sent');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips cancelled delivery', async () => {
    (pool.execute as any).mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM email_deliveries')) {
        return Promise.resolve([mockDelivery({ status: 'cancelled' }), {}]);
      }
      return Promise.resolve([[], {}]);
    });

    const result = await processEmailJob({ data: { deliveryId: 1, deliveryUid: 'test-uid-1' }, attemptsMade: 0 } as any);
    expect(result.status).toBe('cancelled');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends email successfully when rate limits allow', async () => {
    (pool.execute as any).mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM email_deliveries')) {
        return Promise.resolve([mockDelivery({ status: 'scheduled' }), {}]);
      }
      if (query.includes('SELECT * FROM sender_configs')) {
        return Promise.resolve([mockSender(), {}]);
      }
      return Promise.resolve([[], {}]);
    });

    const result = await processEmailJob({ data: { deliveryId: 1, deliveryUid: 'test-uid-1' }, attemptsMade: 0 } as any);
    expect(result.status).toBe('sent');
    expect(sendEmail).toHaveBeenCalled();
  });

  it('marks delivery as failed when SMTP fails and max attempts reached', async () => {
    (sendEmail as any).mockRejectedValueOnce(new Error('SMTP connection refused'));
    (pool.execute as any).mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM email_deliveries')) {
        return Promise.resolve([mockDelivery({ status: 'queued', attempts: 4, max_attempts: 5 }), {}]);
      }
      if (query.includes('SELECT * FROM sender_configs')) {
        return Promise.resolve([mockSender(), {}]);
      }
      return Promise.resolve([[], {}]);
    });

    const result = await processEmailJob({ data: { deliveryId: 1, deliveryUid: 'test-uid-1' }, attemptsMade: 4 } as any);
    expect(result.status).toBe('failed');
  });

  it('retries when SMTP fails and attempts remain', async () => {
    (sendEmail as any).mockRejectedValueOnce(new Error('SMTP timeout'));
    (pool.execute as any).mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM email_deliveries')) {
        return Promise.resolve([mockDelivery({ status: 'queued', attempts: 0, max_attempts: 5 }), {}]);
      }
      if (query.includes('SELECT * FROM sender_configs')) {
        return Promise.resolve([mockSender(), {}]);
      }
      return Promise.resolve([[], {}]);
    });

    await expect(
      processEmailJob({ data: { deliveryId: 1, deliveryUid: 'test-uid-1' }, attemptsMade: 0 } as any),
    ).rejects.toThrow('SMTP timeout');
  });

  it('reschedules when hourly limit is reached', async () => {
    (redis.get as any).mockImplementation((key: string) => {
      if (key.startsWith('eos:delay:')) return Promise.resolve(null);
      return Promise.resolve(null);
    });
    (redis.incr as any).mockResolvedValueOnce(51);

    (pool.execute as any).mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM email_deliveries')) {
        return Promise.resolve([mockDelivery({ status: 'scheduled' }), {}]);
      }
      if (query.includes('SELECT * FROM sender_configs')) {
        return Promise.resolve([mockSender({ hourly_limit: 50 }), {}]);
      }
      return Promise.resolve([[], {}]);
    });

    const result = await processEmailJob({ data: { deliveryId: 1, deliveryUid: 'test-uid-1' }, attemptsMade: 0 } as any);
    expect(result.status).toBe('rescheduled');
    expect(emailQueue.add).toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('reschedules when minimum delay is not met', async () => {
    const recentTs = Date.now() - 1000;
    (redis.get as any).mockImplementation((key: string) => {
      if (key.startsWith('eos:delay:')) return Promise.resolve(String(recentTs));
      return Promise.resolve(null);
    });
    (redis.incr as any).mockResolvedValueOnce(1);

    (pool.execute as any).mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM email_deliveries')) {
        return Promise.resolve([mockDelivery({ status: 'scheduled' }), {}]);
      }
      if (query.includes('SELECT * FROM sender_configs')) {
        return Promise.resolve([mockSender({ min_delay_sec: 60 }), {}]);
      }
      return Promise.resolve([[], {}]);
    });

    const result = await processEmailJob({ data: { deliveryId: 1, deliveryUid: 'test-uid-1' }, attemptsMade: 0 } as any);
    expect(result.status).toBe('rescheduled');
    expect(emailQueue.add).toHaveBeenCalled();
  });
});
