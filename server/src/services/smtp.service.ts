import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface SmtpSendResult {
  messageId: string;
  previewUrl: string;
}

let cachedEtherealCreds: { user: string; pass: string } | null = null;

async function getEtherealCredentials(): Promise<{ user: string; pass: string }> {
  if (config.ETHEREAL_USER && config.ETHEREAL_PASS) {
    return { user: config.ETHEREAL_USER, pass: config.ETHEREAL_PASS };
  }
  if (cachedEtherealCreds) return cachedEtherealCreds;

  const testAccount = await nodemailer.createTestAccount();
  cachedEtherealCreds = { user: testAccount.user, pass: testAccount.pass };
  logger.info(`Generated Ethereal test account: ${testAccount.user}`);
  return cachedEtherealCreds;
}

export async function createTransport(): Promise<nodemailer.Transporter> {
  const creds = await getEtherealCredentials();
  return nodemailer.createTransport({
    host: config.ETHEREAL_HOST,
    port: config.ETHEREAL_PORT,
    secure: false,
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
  });
}

export async function sendEmail(opts: {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
}): Promise<SmtpSendResult> {
  const transport = await createTransport();

  const info = await transport.sendMail({
    from: `"${opts.fromName}" <${opts.fromEmail}>`,
    to: opts.toName ? `"${opts.toName}" <${opts.toEmail}>` : opts.toEmail,
    subject: opts.subject,
    text: opts.body,
    html: opts.body,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || '';
  logger.info(`Email sent to ${opts.toEmail}, messageId: ${info.messageId}, preview: ${previewUrl}`);

  return { messageId: info.messageId, previewUrl };
}
