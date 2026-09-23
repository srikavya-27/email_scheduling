import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../src/config/env.js', () => ({
  config: {
    ELASTICSEARCH_NODE: 'http://localhost:9200',
    ELASTICSEARCH_INDEX: 'test_index',
  },
}));

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  index: vi.fn(),
  exists: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@elastic/elasticsearch', () => ({
  Client: vi.fn(() => ({
    indices: { exists: mocks.exists, create: mocks.create },
    index: mocks.index,
    search: mocks.search,
  })),
}));

import { ensureEsIndex, indexDelivery, searchDeliveries } from '../src/services/elasticsearch.service.js';

describe('Elasticsearch Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensureEsIndex creates index when it does not exist', async () => {
    mocks.exists.mockResolvedValueOnce(false);
    mocks.create.mockResolvedValueOnce({ acknowledged: true });

    await ensureEsIndex();
    expect(mocks.exists).toHaveBeenCalledWith({ index: 'test_index' });
    expect(mocks.create).toHaveBeenCalled();
  });

  it('ensureEsIndex does not create when index exists', async () => {
    mocks.exists.mockResolvedValueOnce(true);

    await ensureEsIndex();
    expect(mocks.exists).toHaveBeenCalledWith({ index: 'test_index' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('indexDelivery indexes a delivery record', async () => {
    mocks.index.mockResolvedValueOnce({ result: 'created' });

    const delivery = {
      id: 1, delivery_uid: 'uid-1', campaign_id: 1, recipient_id: 1, sender_id: 1, user_id: 1,
      to_email: 'test@example.com', to_name: 'Test', subject: 'Subject', body: 'Body',
      status: 'sent', scheduled_time: new Date(), actual_send_time: new Date(),
      attempts: 1, last_error: null, ethereal_preview_url: 'https://preview.test',
      ethereal_message_id: 'msg-1', created_at: new Date(), updated_at: new Date(),
    };

    await indexDelivery(delivery as any);
    expect(mocks.index).toHaveBeenCalled();
  });

  it('searchDeliveries returns paginated results', async () => {
    mocks.search.mockResolvedValueOnce({
      hits: {
        hits: [{ _source: { delivery_uid: 'uid-1', to_email: 'test@example.com' } }],
        total: { value: 1 },
      },
    });

    const result = await searchDeliveries({ query: 'test', userId: 1, page: 1, pageSize: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });
});
