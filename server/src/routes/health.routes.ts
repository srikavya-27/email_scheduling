import { Router } from 'express';
import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';
import { ok } from '../utils/response.js';

const router = Router();

router.get('/health', async (_req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: { mysql: 'unknown', redis: 'unknown' },
  };

  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    health.services.mysql = 'ok';
  } catch {
    health.services.mysql = 'down';
    health.status = 'degraded';
  }

  try {
    const pong = await redis.ping();
    health.services.redis = pong === 'PONG' ? 'ok' : 'down';
  } catch {
    health.services.redis = 'down';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json(health);
});

export default router;
