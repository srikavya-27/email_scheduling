import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { authMiddleware } from '../auth/auth.routes.js';
import { createCampaign, cancelCampaign, getCampaignStats } from '../services/campaign.service.js';
import { parseRecipientsFile, scheduleSchema } from '../services/recipient.service.js';
import { ok, paginate } from '../utils/response.js';
import { ValidationError, NotFoundError, asyncHandler } from '../utils/errors.js';
import type { AuthedUser } from '../types/index.js';
import type { Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));

  const [countRows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) as total FROM campaigns WHERE user_id = ?',
    [user.id],
  );
  const total = (countRows[0] as any).total;

  const [campaigns] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [user.id, pageSize, (page - 1) * pageSize],
  );

  return ok(res, paginate(campaigns, total, page, pageSize));
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const campaignId = parseInt(req.params.id);

  const [campaigns] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM campaigns WHERE id = ? AND user_id = ?',
    [campaignId, user.id],
  );
  if (campaigns.length === 0) throw new NotFoundError('Campaign not found');

  const stats = await getCampaignStats(campaignId);
  return ok(res, { ...(campaigns[0] as any), ...stats });
}));

router.post('/parse-recipients', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ValidationError('No file uploaded');
  const content = req.file.buffer.toString('utf-8');
  const result = parseRecipientsFile(content, req.file.originalname);
  return ok(res, result);
}));

router.post('/schedule', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;

  let recipients = req.body.recipients;
  if (!recipients && req.body.recipientsJson) {
    try { recipients = JSON.parse(req.body.recipientsJson); } catch { throw new ValidationError('Invalid recipients JSON'); }
  }

  const parsed = scheduleSchema.safeParse({
    ...req.body,
    recipients,
    minDelaySec: parseInt(req.body.minDelaySec) || 60,
    hourlyLimit: parseInt(req.body.hourlyLimit) || 50,
    senderId: parseInt(req.body.senderId),
    startTime: req.body.startTime,
    subject: req.body.subject,
    body: req.body.body,
  });

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.issues);
  }

  const data = parsed.data;
  const result = await createCampaign({
    userId: user.id,
    senderId: data.senderId,
    subject: data.subject,
    body: data.body,
    startTime: new Date(data.startTime),
    minDelaySec: data.minDelaySec,
    hourlyLimit: data.hourlyLimit,
    recipients: data.recipients.map((r) => ({ email: r.email, name: r.name || '' })),
  });

  return ok(res, { campaignId: result.campaignId, deliveryCount: result.deliveryCount }, 201);
}));

router.post('/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const campaignId = parseInt(req.params.id);
  await cancelCampaign(user.id, campaignId);
  return ok(res, { message: 'Campaign cancelled' });
}));

router.get('/:id/deliveries', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const campaignId = parseInt(req.params.id);
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

  const [campRows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM campaigns WHERE id = ? AND user_id = ?',
    [campaignId, user.id],
  );
  if (campRows.length === 0) throw new NotFoundError('Campaign not found');

  const [countRows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) as total FROM email_deliveries WHERE campaign_id = ? AND user_id = ?',
    [campaignId, user.id],
  );
  const total = (countRows[0] as any).total;

  const [deliveries] = await pool.execute<RowDataPacket[]>(
    `SELECT id, delivery_uid, to_email, to_name, subject, status, scheduled_time, actual_send_time, attempts, last_error, ethereal_preview_url
     FROM email_deliveries WHERE campaign_id = ? AND user_id = ? ORDER BY scheduled_time ASC LIMIT ? OFFSET ?`,
    [campaignId, user.id, pageSize, (page - 1) * pageSize],
  );

  return ok(res, paginate(deliveries, total, page, pageSize));
}));

export default router;
