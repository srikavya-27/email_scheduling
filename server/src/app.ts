import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { testDbConnection } from './config/db.js';
import { runMigrations } from './db/migrations/schema.js';
import { ensureEsIndex } from './services/elasticsearch.service.js';
import { sessionMiddleware, authMiddleware } from './auth/auth.routes.js';
import authRouter from './auth/auth.routes.js';
import healthRouter from './routes/health.routes.js';
import campaignRouter from './routes/campaign.routes.js';
import deliveryRouter from './routes/delivery.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import searchRouter from './routes/search.routes.js';
import slackRouter from './routes/slack.routes.js';
import { setupBullBoard } from './queue/bull-board.js';
import { AppError } from './utils/errors.js';

export async function createApp(): Promise<express.Application> {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: config.CLIENT_ORIGIN,
    credentials: true,
  }));
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan('dev'));
  app.use(sessionMiddleware);

  app.use('/api/auth', authRouter);
  app.use('/api/health', healthRouter);
  app.use('/api/campaigns', campaignRouter);
  app.use('/api/deliveries', deliveryRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/slack', slackRouter);

  app.use('/admin/queues', authMiddleware, setupBullBoard());

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ success: false, error: err.message, ...(err.details ? { details: err.details } : {}) });
    }
    logger.error('Unhandled error', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  });

  return app;
}

export async function startServer(): Promise<void> {
  await testDbConnection();
  await runMigrations();
  await ensureEsIndex().catch((err) => logger.warn(`ES setup skipped: ${err}`));

  const app = await createApp();
  app.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    logger.error('Failed to start server', err);
    process.exit(1);
  });
}
