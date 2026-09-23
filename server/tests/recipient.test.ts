import { describe, it, expect } from 'vitest';
import { parseRecipientsFile, validateEmail } from '../src/services/recipient.service.js';

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co.uk')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('missing@domain')).toBe(false);
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
  });
});

describe('parseRecipientsFile - CSV with header', () => {
  it('parses CSV with email and name columns', () => {
    const csv = 'email,name\nuser1@test.com,Alice\nuser2@test.com,Bob';
    const result = parseRecipientsFile(csv, 'recipients.csv');
    expect(result.total).toBe(2);
    expect(result.recipients[0].email).toBe('user1@test.com');
    expect(result.recipients[0].name).toBe('Alice');
    expect(result.duplicates).toBe(0);
    expect(result.invalid).toBe(0);
  });

  it('detects and removes duplicates', () => {
    const csv = 'email,name\nuser1@test.com,Alice\nuser1@test.com,Alice2\nuser2@test.com,Bob';
    const result = parseRecipientsFile(csv, 'recipients.csv');
    expect(result.total).toBe(2);
    expect(result.duplicates).toBe(1);
  });

  it('detects invalid emails', () => {
    const csv = 'email\nvalid@test.com\nnot-valid\nalso@bad\nuser@test.com';
    const result = parseRecipientsFile(csv, 'recipients.csv');
    expect(result.total).toBe(2);
    expect(result.invalid).toBe(2);
  });
});

describe('parseRecipientsFile - TXT', () => {
  it('parses plain email list', () => {
    const txt = 'user1@test.com\nuser2@test.com\nuser3@test.com';
    const result = parseRecipientsFile(txt, 'emails.txt');
    expect(result.total).toBe(3);
    expect(result.recipients[0].email).toBe('user1@test.com');
  });

  it('parses tab-separated email and name', () => {
    const txt = 'user1@test.com\tAlice\nuser2@test.com\tBob';
    const result = parseRecipientsFile(txt, 'emails.txt');
    expect(result.total).toBe(2);
    expect(result.recipients[0].name).toBe('Alice');
  });

  it('handles empty lines', () => {
    const txt = 'user1@test.com\n\n\nuser2@test.com\n';
    const result = parseRecipientsFile(txt, 'emails.txt');
    expect(result.total).toBe(2);
  });
});

describe('parseRecipientsFile - edge cases', () => {
  it('handles CSV without header (email in first column)', () => {
    const csv = 'user1@test.com\nuser2@test.com';
    const result = parseRecipientsFile(csv, 'recipients.csv');
    expect(result.total).toBe(2);
  });

  it('handles mixed case emails (normalizes to lowercase)', () => {
    const csv = 'email\nUser@Test.COM\nuser@test.com';
    const result = parseRecipientsFile(csv, 'recipients.csv');
    expect(result.total).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.recipients[0].email).toBe('user@test.com');
  });
});
