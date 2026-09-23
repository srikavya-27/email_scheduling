import { Router } from 'express';
import { authMiddleware } from '../auth/auth.routes.js';
import { searchDeliveries } from '../services/elasticsearch.service.js';
import { ok } from '../utils/response.js';
import { asyncHandler, ValidationError } from '../utils/errors.js';
import type { AuthedUser } from '../types/index.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(authMiddleware);

router.get('/emails', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const query = (req.query.q as string || '').trim();
  if (!query) throw new ValidationError('Search query (q) is required');

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const status = (req.query.status as string) || 'all';

  const result = await searchDeliveries({ query, userId: user.id, status, page, pageSize });
  return ok(res, result);
}));

export default router;
