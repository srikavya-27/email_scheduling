import { logger } from './config/logger.js';
import { testDbConnection } from './config/db.js';
import { runMigrations } from './db/migrations/schema.js';
import { ensureEsIndex } from './services/elasticsearch.service.js';
import { startWorker } from './queue/email.worker.js';

async function main(): Promise<void> {
  await testDbConnection();
  await runMigrations();
  await ensureEsIndex().catch((err) => logger.warn(`ES setup skipped: ${err}`));
  startWorker();
  logger.info('Worker process running');
}

main().catch((err) => {
  logger.error('Worker startup failed', err);
  process.exit(1);
});
