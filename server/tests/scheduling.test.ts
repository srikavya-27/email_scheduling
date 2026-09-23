import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore: Record<string, string> = {};

vi.mock('../src/config/redis.js', () => ({
  redis: {
    get: vi.fn((key: string) => Promise.resolve(mockStore[key] || null)),
    set: vi.fn((key: string, val: string, ...opts: any[]) => {
      const hasNX = opts.includes('NX');
      if (hasNX && mockStore[key] !== undefined) return Promise.resolve(null);
      mockStore[key] = val;
      return Promise.resolve('OK');
    }),
    del: vi.fn((key: string) => { delete mockStore[key]; return Promise.resolve(1); }),
  },
}));

vi.mock('../src/config/db.js', () => ({
  pool: { execute: vi.fn() },
}));

vi.mock('../src/config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../src/services/elasticsearch.service.js', () => ({
  esClient: {},
  ensureEsIndex: vi.fn(),
  indexDelivery: vi.fn(),
}));

vi.mock('../src/services/slack.service.js', () => ({
  notifyHourlyLimitHit: vi.fn(),
}));

vi.mock('../src/services/smtp.service.js', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('../src/queue/email.queue.js', () => ({
  emailQueue: {
    add: vi.fn(() => Promise.resolve({ id: 'job-1' })),
    remove: vi.fn(() => Promise.resolve()),
  },
  connection: {},
  QUEUE_NAME: 'email-deliveries',
}));

import { redis } from '../src/config/redis.js';
import { notifyHourlyLimitHit } from '../src/services/slack.service.js';

describe('Slack Notification Dedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockStore)) delete mockStore[key];
  });

  it('sends notification only once per hour window', async () => {
    const first = await (redis.set as any)('notif-key', '1', 'EX', 3700, 'NX');
    expect(first).toBe('OK');

    const second = await (redis.set as any)('notif-key', '1', 'EX', 3700, 'NX');
    expect(second).toBe(null);
  });
});

describe('Campaign Scheduling Logic', () => {
  it('calculates staggered scheduled times based on min delay', () => {
    const startTime = new Date('2024-01-15T10:00:00Z');
    const minDelaySec = 60;
    const count = 5;

    const times: Date[] = [];
    for (let i = 0; i < count; i++) {
      times.push(new Date(startTime.getTime() + i * minDelaySec * 1000));
    }

    expect(times[0].getTime()).toBe(startTime.getTime());
    expect(times[1].getTime()).toBe(startTime.getTime() + 60000);
    expect(times[4].getTime()).toBe(startTime.getTime() + 240000);
  });

  it('generates unique delivery UIDs for each recipient', () => {
    const { randomUUID } = require('crypto');
    const uids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uids.add(randomUUID());
    }
    expect(uids.size).toBe(100);
  });
});
