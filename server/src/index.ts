import { startServer } from './app.js';

startServer().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
