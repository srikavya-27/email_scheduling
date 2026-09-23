import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore: Record<string, string> = {};

vi.mock('../src/config/redis.js', () => {
  return {
    redis: {
      get: vi.fn((key: string) => Promise.resolve(mockStore[key] || null)),
      set: vi.fn((key: string, val: string, ...opts: any[]) => {
        const hasNX = opts.includes('NX');
        if (hasNX && mockStore[key] !== undefined) return Promise.resolve(null);
        mockStore[key] = val;
        return Promise.resolve('OK');
      }),
      incr: vi.fn((key: string) => {
        mockStore[key] = String((parseInt(mockStore[key] || '0', 10)) + 1);
        return Promise.resolve(parseInt(mockStore[key], 10));
      }),
      decr: vi.fn((key: string) => {
        mockStore[key] = String((parseInt(mockStore[key] || '0', 10)) - 1);
        return Promise.resolve(parseInt(mockStore[key], 10));
      }),
      expire: vi.fn(() => Promise.resolve(1)),
      ping: vi.fn(() => Promise.resolve('PONG')),
    },
  };
});

vi.mock('../src/config/db.js', () => ({
  pool: {
    execute: vi.fn(() => Promise.resolve([[], {}])),
    getConnection: vi.fn(() => Promise.resolve({
      execute: vi.fn(() => Promise.resolve([[], {}])),
      release: vi.fn(),
    })),
  },
}));

vi.mock('../src/config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { acquireSendSlot, checkMinimumDelay, currentHourKey, nextHourStart } from '../src/services/rate-limiter.service.js';
import { redis } from '../src/config/redis.js';

describe('Rate Limiter', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) delete mockStore[key];
    vi.clearAllMocks();
  });

  describe('currentHourKey', () => {
    it('generates a key with sender ID and timestamp', () => {
      const key = currentHourKey(42);
      expect(key).toContain('eos:rate:42:');
      expect(key.length).toBeGreaterThan(15);
    });
  });

  describe('nextHourStart', () => {
    it('returns the start of the next hour', () => {
      const now = new Date('2024-01-15T10:30:00Z');
      const next = nextHourStart(now);
      expect(next.getUTCHours()).toBe(11);
      expect(next.getUTCMinutes()).toBe(0);
      expect(next.getUTCSeconds()).toBe(0);
    });
  });

  describe('checkMinimumDelay', () => {
    it('allows send when no previous send recorded', async () => {
      const allowed = await checkMinimumDelay(1, 60);
      expect(allowed).toBe(true);
    });
  });

  describe('acquireSendSlot', () => {
    it('allows send when under hourly limit', async () => {
      const result = await acquireSendSlot(1, 50, 60);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('ok');
    });

    it('blocks send when hourly limit reached', async () => {
      (redis.get as any).mockImplementationOnce((key: string) => {
        if (key.startsWith('eos:delay:')) return Promise.resolve(null);
        return Promise.resolve(null);
      });
      (redis.incr as any).mockResolvedValueOnce(51);

      const result = await acquireSendSlot(1, 50, 60);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('hourly_limit');
    });

    it('blocks send when minimum delay not met', async () => {
      const recentTs = Date.now() - 1000;
      (redis.get as any).mockImplementationOnce((key: string) => {
        if (key.startsWith('eos:delay:')) return Promise.resolve(String(recentTs));
        return Promise.resolve(null);
      });

      const result = await acquireSendSlot(1, 50, 60);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('min_delay');
    });
  });
});
