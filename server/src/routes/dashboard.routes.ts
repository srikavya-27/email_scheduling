import { Router } from 'express';
import { pool } from '../config/db.js';
import { authMiddleware } from '../auth/auth.routes.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/errors.js';
import type { AuthedUser, DashboardStats } from '../types/index.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(authMiddleware);

router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;

  const [campaignRows] = await pool.execute<any[]>(
    'SELECT COUNT(*) as total, SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed FROM campaigns WHERE user_id = ?',
    [user.id],
  );

  const [deliveryRows] = await pool.execute<any[]>(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
     FROM email_deliveries WHERE user_id = ?`,
    [user.id],
  );

  const stats: DashboardStats = {
    totalCampaigns: Number(campaignRows[0]?.total || 0),
    totalEmails: Number(deliveryRows[0]?.total || 0),
    sentCount: Number(deliveryRows[0]?.sent || 0),
    failedCount: Number(deliveryRows[0]?.failed || 0),
    pendingCount: Number(deliveryRows[0]?.pending || 0),
    scheduledCount: Number(deliveryRows[0]?.scheduled || 0),
    inProgressCount: Number(deliveryRows[0]?.in_progress || 0),
    successRate: 0,
  };

  const totalAttempted = stats.sentCount + stats.failedCount;
  stats.successRate = totalAttempted > 0 ? Math.round((stats.sentCount / totalAttempted) * 1000) / 10 : 0;

  return ok(res, stats);
}));

router.get('/senders', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const [rows] = await pool.execute<any[]>(
    'SELECT id, from_name, from_email, hourly_limit, min_delay_sec, is_active FROM sender_configs WHERE user_id = ?',
    [user.id],
  );
  return ok(res, rows);
}));

router.patch('/senders/:id', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const senderId = parseInt(req.params.id);
  const { fromName, fromEmail, hourlyLimit, minDelaySec } = req.body;

  await pool.execute(
    'UPDATE sender_configs SET from_name = COALESCE(?, from_name), from_email = COALESCE(?, from_email), hourly_limit = COALESCE(?, hourly_limit), min_delay_sec = COALESCE(?, min_delay_sec) WHERE id = ? AND user_id = ?',
    [fromName || null, fromEmail || null, hourlyLimit || null, minDelaySec || null, senderId, user.id],
  );
  return ok(res, { message: 'Sender updated' });
}));

export default router;
