import winston from 'winston';
import { config } from './env.js';

export const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'email-outreach' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length && meta.service
            ? ''
            : ` ${JSON.stringify(meta)}`;
          return `${timestamp} ${level}: ${message}${metaStr}`;
        }),
      ),
    }),
  ],
});
