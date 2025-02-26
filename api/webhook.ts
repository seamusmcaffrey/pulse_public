import type { VercelRequest, VercelResponse } from "./types";
import { createHmac } from 'crypto';

// Verify SendGrid webhook signature
const verifySignature = (payload: string, signature: string, timestamp: string) => {
  const key = process.env.SENDGRID_API_KEY || "";
  const data = timestamp + payload;
  const hmac = createHmac('sha256', key);
  hmac.update(data);
  const generatedSignature = hmac.digest('base64');
  return signature === generatedSignature;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Log the raw request for debugging
    console.log("Webhook Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Webhook Body:", JSON.stringify(req.body, null, 2));

    // Ensure we have an array of events
    const events = Array.isArray(req.body) ? req.body : [req.body];

    // Store events in Supabase
    const { error } = await fetch(process.env.VITE_SUPABASE_URL + '/rest/v1/email_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(events.map((event: any) => ({
        email: event.email,
        event_type: event.event,
        message_id: event.sg_message_id,
        timestamp: new Date(event.timestamp * 1000).toISOString(),
        metadata: event
      })))
    }).then(r => r.json());

    if (error) {
      console.error('Error storing email events:', error);
      return res.status(500).json({ error: "Failed to store events" });
    }

    return res.status(200).json({ message: "Events processed successfully" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
