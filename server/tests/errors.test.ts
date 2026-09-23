import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/db.js', () => ({
  pool: { execute: vi.fn() },
}));

vi.mock('../src/config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../src/config/redis.js', () => ({
  redis: { ping: vi.fn(() => Promise.resolve('PONG')) },
}));

import { ok, fail, paginate } from '../src/utils/response.js';

describe('Response utilities', () => {
  it('ok() returns success response with data', () => {
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    ok(res, { test: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { test: true } });
  });

  it('ok() accepts custom status code', () => {
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    ok(res, { created: true }, 201);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('fail() returns error response', () => {
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    fail(res, 'Bad request', 400);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Bad request' });
  });

  it('paginate() returns correct pagination metadata', () => {
    const result = paginate([1, 2, 3], 100, 1, 3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
    expect(result.total).toBe(100);
    expect(result.totalPages).toBe(34);
  });

  it('paginate() handles empty results', () => {
    const result = paginate([], 0, 1, 10);
    expect(result.totalPages).toBe(1);
  });
});

import { AppError, ValidationError, UnauthorizedError, NotFoundError, ConflictError } from '../src/utils/errors.js';

describe('Error classes', () => {
  it('AppError has correct statusCode', () => {
    const err = new AppError('test', 400);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('test');
  });

  it('ValidationError has 422 status', () => {
    const err = new ValidationError('Invalid input');
    expect(err.statusCode).toBe(422);
  });

  it('UnauthorizedError has 401 status', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it('NotFoundError has 404 status', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  it('ConflictError has 409 status', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
  });
});
