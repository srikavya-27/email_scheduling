import { pool } from '../config/db.js';
import { logger } from '../config/logger.js';
import { indexDelivery } from '../services/elasticsearch.service.js';
import type { RowDataPacket } from 'mysql2';

export async function getDeliveryById(id: number): Promise<any | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM email_deliveries WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getDeliveryByUid(uid: string): Promise<any | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM email_deliveries WHERE delivery_uid = ?',
    [uid],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function markDeliverySent(
  deliveryId: number,
  messageId: string,
  previewUrl: string,
): Promise<void> {
  await pool.execute(
    `UPDATE email_deliveries
     SET status = 'sent', actual_send_time = NOW(), ethereal_message_id = ?, ethereal_preview_url = ?, last_error = NULL
     WHERE id = ? AND status != 'sent'`,
    [messageId, previewUrl, deliveryId],
  );

  const delivery = await getDeliveryById(deliveryId);
  if (delivery) {
    await indexDelivery(delivery).catch((err) =>
      logger.warn(`ES indexing failed for delivery ${deliveryId}: ${err}`),
    );
  }

  await pool.execute(
    'UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = (SELECT campaign_id FROM email_deliveries WHERE id = ?)',
    [deliveryId],
  );
}

export async function markDeliveryFailed(
  deliveryId: number,
  error: string,
): Promise<void> {
  await pool.execute(
    `UPDATE email_deliveries
     SET status = 'failed', last_error = ?, attempts = attempts + 1
     WHERE id = ?`,
    [error, deliveryId],
  );

  const delivery = await getDeliveryById(deliveryId);
  if (delivery) {
    await indexDelivery(delivery).catch((err) =>
      logger.warn(`ES indexing failed for delivery ${deliveryId}: ${err}`),
    );
  }

  await pool.execute(
    'UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = (SELECT campaign_id FROM email_deliveries WHERE id = ?)',
    [deliveryId],
  );
}
