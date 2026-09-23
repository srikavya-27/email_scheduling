import { Router } from 'express';
import { pool } from '../config/db.js';
import { authMiddleware } from '../auth/auth.routes.js';
import { ok, paginate } from '../utils/response.js';
import { NotFoundError, asyncHandler } from '../utils/errors.js';
import type { AuthedUser } from '../types/index.js';
import type { Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';

const router = Router();

router.use(authMiddleware);

router.get('/scheduled', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

  const statuses = ['scheduled', 'pending', 'rescheduled', 'queued'];
  const placeholders = statuses.map(() => '?').join(',');

  const [countRows] = await pool.execute<any[]>(
    `SELECT COUNT(*) as total FROM email_deliveries WHERE user_id = ? AND status IN (${placeholders})`,
    [user.id, ...statuses],
  );
  const total = countRows[0].total;

  const [rows] = await pool.execute<any[]>(
    `SELECT d.id, d.delivery_uid, d.to_email, d.to_name, d.subject, d.status, d.scheduled_time, d.campaign_id, d.attempts
     FROM email_deliveries d
     WHERE d.user_id = ? AND d.status IN (${placeholders})
     ORDER BY d.scheduled_time ASC LIMIT ? OFFSET ?`,
    [user.id, ...statuses, pageSize, (page - 1) * pageSize],
  );

  return ok(res, paginate(rows, total, page, pageSize));
}));

router.get('/sent', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

  const [countRows] = await pool.execute<any[]>(
    "SELECT COUNT(*) as total FROM email_deliveries WHERE user_id = ? AND status IN ('sent','failed')",
    [user.id],
  );
  const total = countRows[0].total;

  const [rows] = await pool.execute<any[]>(
    `SELECT d.id, d.delivery_uid, d.to_email, d.to_name, d.subject, d.status, d.actual_send_time, d.campaign_id,
            d.attempts, d.last_error, d.ethereal_preview_url, d.ethereal_message_id
     FROM email_deliveries d
     WHERE d.user_id = ? AND d.status IN ('sent','failed')
     ORDER BY d.actual_send_time DESC LIMIT ? OFFSET ?`,
    [user.id, pageSize, (page - 1) * pageSize],
  );

  return ok(res, paginate(rows, total, page, pageSize));
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const deliveryId = parseInt(req.params.id);

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM email_deliveries WHERE id = ? AND user_id = ?',
    [deliveryId, user.id],
  );
  if (rows.length === 0) throw new NotFoundError('Delivery not found');

  return ok(res, rows[0]);
}));

export default router;
