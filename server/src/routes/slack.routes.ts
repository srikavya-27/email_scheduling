import { Router } from 'express';
import { config } from '../config/env.js';
import { authMiddleware } from '../auth/auth.routes.js';
import { getSlackIntegration, saveSlackIntegration, disconnectSlack, exchangeSlackCode } from '../services/slack.service.js';
import { ok, fail } from '../utils/response.js';
import { asyncHandler, NotFoundError, ValidationError } from '../utils/errors.js';
import type { AuthedUser } from '../types/index.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(authMiddleware);

router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const slack = await getSlackIntegration(user.id);
  if (!slack) return ok(res, { connected: false });
  return ok(res, {
    connected: true,
    teamName: slack.team_name,
    teamId: slack.team_id,
  });
}));

router.get('/connect', asyncHandler(async (req: Request, res: Response) => {
  if (!config.SLACK_CLIENT_ID || !config.SLACK_CLIENT_SECRET) {
    throw new ValidationError('Slack OAuth credentials not configured');
  }
  const params = new URLSearchParams({
    client_id: config.SLACK_CLIENT_ID,
    scope: 'chat:write,channels:read',
    redirect_uri: config.SLACK_REDIRECT_URI,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}));

router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) throw new ValidationError('Missing code parameter');

  const data = await exchangeSlackCode(code);

  const user = req.user as AuthedUser;
  if (!user) {
    return res.redirect(`${config.CLIENT_ORIGIN}/settings?error=auth_lost`);
  }

  await saveSlackIntegration(user.id, {
    team_id: data.team?.id || '',
    team_name: data.team?.name || '',
    bot_user_id: data.bot_user_id || '',
    access_token: data.access_token,
    scopes: data.scope || '',
    webhook_url: data.incoming_webhook?.url || '',
  });

  res.redirect(`${config.CLIENT_ORIGIN}/settings?slack=connected`);
}));

router.post('/disconnect', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  await disconnectSlack(user.id);
  return ok(res, { message: 'Slack disconnected' });
}));

router.post('/reconnect', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthedUser;
  const slack = await getSlackIntegration(user.id);
  if (!slack) throw new NotFoundError('No previous Slack integration found');

  const params = new URLSearchParams({
    client_id: config.SLACK_CLIENT_ID,
    scope: 'chat:write,channels:read',
    redirect_uri: config.SLACK_REDIRECT_URI,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}));

export default router;
