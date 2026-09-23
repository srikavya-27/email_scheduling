import type { Response } from 'express';

export function ok<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function fail(res: Response, message: string, statusCode = 400, details?: unknown) {
  return res.status(statusCode).json({ success: false, error: message, ...(details ? { details } : {}) });
}

export function paginate<T>(data: T[], total: number, page: number, pageSize: number) {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}
