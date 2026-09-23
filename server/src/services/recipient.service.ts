import { parse as csvParse } from 'csv-parse/sync';
import { z } from 'zod';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRecipient {
  email: string;
  name: string;
}

export interface ParseResult {
  recipients: ParsedRecipient[];
  duplicates: number;
  invalid: number;
  total: number;
}

export function validateEmail(email: string): boolean {
  return emailRegex.test(email.trim());
}

export function parseRecipientsFile(content: string, filename: string): ParseResult {
  let rows: string[][] = [];
  const isCsv = filename.toLowerCase().endsWith('.csv');

  if (isCsv) {
    rows = csvParse(content, {
      delimiter: ',',
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    });
  } else {
    rows = content
      .split(/\r?\n/)
      .map((line) => line.split(/[,\t]/).map((c) => c.trim()))
      .filter((r) => r.some((c) => c.length > 0));
  }

  let emailCol = 0;
  let nameCol = -1;

  if (rows.length > 0) {
    const header = rows[0].map((c) => c.toLowerCase().trim());
    const eIdx = header.findIndex((h) => h === 'email' || h === 'e-mail' || h === 'address');
    if (eIdx >= 0) {
      emailCol = eIdx;
      rows = rows.slice(1);
      const nIdx = header.findIndex((h) => h === 'name' || h === 'full name' || h === 'recipient');
      if (nIdx >= 0) nameCol = nIdx;
    } else if (rows[0].length >= 1 && validateEmail(rows[0][0])) {
      emailCol = 0;
      if (rows[0].length >= 2) nameCol = 1;
    }
  }

  const seen = new Set<string>();
  const recipients: ParsedRecipient[] = [];
  let duplicates = 0;
  let invalid = 0;

  for (const row of rows) {
    const rawEmail = (row[emailCol] || '').trim().toLowerCase();
    const rawName = nameCol >= 0 ? (row[nameCol] || '').trim() : '';

    if (!rawEmail) continue;
    if (!validateEmail(rawEmail)) {
      invalid++;
      continue;
    }

    if (seen.has(rawEmail)) {
      duplicates++;
      continue;
    }
    seen.add(rawEmail);
    recipients.push({ email: rawEmail, name: rawName });
  }

  return {
    recipients,
    duplicates,
    invalid,
    total: recipients.length,
  };
}

export const scheduleSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  startTime: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid start time'),
  minDelaySec: z.number().int().min(1).max(3600).default(60),
  hourlyLimit: z.number().int().min(1).max(10000).default(50),
  senderId: z.number().int().positive(),
  recipients: z.array(
    z.object({
      email: z.string().refine(validateEmail, 'Invalid email'),
      name: z.string().optional().default(''),
    }),
  ).min(1, 'At least one recipient required'),
});
