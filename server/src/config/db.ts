import mysql from 'mysql2/promise';
import { config } from './env.js';
import { logger } from './logger.js';

export const pool = mysql.createPool({
  host: config.MYSQL_HOST,
  port: config.MYSQL_PORT,
  user: config.MYSQL_USER,
  password: config.MYSQL_PASSWORD,
  database: config.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  multipleStatements: false,
  dateStrings: false,
  timezone: 'Z',
});

export async function testDbConnection(): Promise<void> {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.ping();
    logger.info('MySQL connection established');
  } catch (err) {
    logger.error('MySQL connection failed', err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}
