import { Client } from '@elastic/elasticsearch';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import type { EmailDeliveryRow } from '../types/index.js';

export const esClient = new Client({
  node: config.ELASTICSEARCH_NODE,
  requestTimeout: 10000,
  maxRetries: 3,
});

const INDEX = config.ELASTICSEARCH_INDEX;

const INDEX_MAPPING = {
  properties: {
    delivery_uid: { type: 'keyword' },
    campaign_id: { type: 'long' },
    recipient_id: { type: 'long' },
    sender_id: { type: 'long' },
    user_id: { type: 'long' },
    to_email: { type: 'keyword' },
    to_name: { type: 'text' },
    subject: { type: 'text' },
    body: { type: 'text' },
    status: { type: 'keyword' },
    scheduled_time: { type: 'date' },
    actual_send_time: { type: 'date' },
    attempts: { type: 'integer' },
    last_error: { type: 'text' },
    ethereal_preview_url: { type: 'keyword' },
    ethereal_message_id: { type: 'keyword' },
    created_at: { type: 'date' },
    updated_at: { type: 'date' },
  },
};

export async function ensureEsIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: INDEX,
        mappings: INDEX_MAPPING as any,
      });
      logger.info(`Elasticsearch index "${INDEX}" created`);
    }
  } catch (err) {
    logger.warn(`Elasticsearch index setup failed (will retry on indexing): ${err}`);
  }
}

export async function indexDelivery(delivery: EmailDeliveryRow): Promise<void> {
  await esClient.index({
    index: INDEX,
    id: delivery.delivery_uid,
    document: {
      delivery_uid: delivery.delivery_uid,
      campaign_id: delivery.campaign_id,
      recipient_id: delivery.recipient_id,
      sender_id: delivery.sender_id,
      user_id: delivery.user_id,
      to_email: delivery.to_email,
      to_name: delivery.to_name,
      subject: delivery.subject,
      body: delivery.body,
      status: delivery.status,
      scheduled_time: delivery.scheduled_time,
      actual_send_time: delivery.actual_send_time,
      attempts: delivery.attempts,
      last_error: delivery.last_error,
      ethereal_preview_url: delivery.ethereal_preview_url,
      ethereal_message_id: delivery.ethereal_message_id,
      created_at: delivery.created_at,
      updated_at: delivery.updated_at,
    },
    refresh: false,
  });
}

export interface SearchParams {
  query: string;
  userId: number;
  status?: string;
  page: number;
  pageSize: number;
}

export async function searchDeliveries(params: SearchParams) {
  const { query, userId, status, page, pageSize } = params;
  const from = (page - 1) * pageSize;

  const must: any[] = [
    { term: { user_id: userId } },
  ];

  if (status && status !== 'all') {
    must.push({ term: { status } });
  }

  const should: any[] = [
    { match: { to_email: { query, operator: 'and' } } },
    { match: { to_name: { query, operator: 'and' } } },
    { match: { subject: { query, operator: 'and' } } },
    { match: { body: { query, operator: 'and' } } },
  ];

  const body: any = {
    bool: {
      must,
      should,
      minimum_should_match: 1,
    },
  };

  const result = await esClient.search({
    index: INDEX,
    from,
    size: pageSize,
    query: body,
    sort: [{ scheduled_time: { order: 'desc' } }],
  });

  const hits = (result.hits.hits as any[]).map((h) => h._source);
  const total = typeof result.hits.total === 'number'
    ? result.hits.total
    : (result.hits.total as any)?.value || 0;

  return { data: hits, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}
