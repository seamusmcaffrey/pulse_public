import { VercelRequest, VercelResponse } from "@vercel/node";

export type { VercelRequest, VercelResponse };

export interface ResendWebhookPayload {
  to: string[];
  from: string;
  text: string;
  html?: string;
  subject: string;
  headers: Record<string, string>;
}
