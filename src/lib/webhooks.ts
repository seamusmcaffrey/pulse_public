import { supabase } from "./supabase";
import { handleEmailReply } from "./email";

interface SendGridEvent {
  email: string;
  timestamp: number;
  event: string;
  category?: string[];
  sg_message_id: string;
  response?: string;
  reason?: string;
  status?: string;
  ip?: string;
  useragent?: string;
  url?: string;
}

interface SendGridInboundEmail {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
}

export async function handleEmailWebhook(payload: SendGridEvent | SendGridInboundEmail) {
  // Check if this is an inbound email
  if ('text' in payload && 'to' in payload) {
    return handleEmailReply(payload);
  }

  // Otherwise, handle it as an event
  const event = payload as SendGridEvent;
  
  // Handle different types of SendGrid events
  switch (event.event) {
    case 'processed':
    case 'delivered':
      // Email was successfully processed and delivered
      console.log(`Email ${event.event} to ${event.email}`);
      break;

    case 'open':
      // Email was opened by recipient
      console.log(`Email opened by ${event.email}`);
      break;

    case 'click':
      // Recipient clicked a link in the email
      console.log(`Link clicked by ${event.email}: ${event.url}`);
      break;

    case 'bounce':
      // Email bounced
      console.error(`Email bounced for ${event.email}: ${event.reason}`);
      // You might want to mark the email as invalid in your database
      break;

    case 'dropped':
      // Email was dropped by SendGrid
      console.error(`Email dropped for ${event.email}: ${event.reason}`);
      break;

    case 'spamreport':
      // Email was reported as spam
      console.error(`Spam report from ${event.email}`);
      break;

    case 'unsubscribe':
      // Recipient unsubscribed
      console.log(`Unsubscribe from ${event.email}`);
      break;

    default:
      console.log(`Unhandled event type: ${event.event}`);
  }

  // Store the event in Supabase for tracking
  const { error } = await supabase.from('email_events').insert([{
    email: event.email,
    event_type: event.event,
    message_id: event.sg_message_id,
    timestamp: new Date(event.timestamp * 1000).toISOString(),
    metadata: event
  }]);

  if (error) {
    console.error('Error storing email event:', error);
    throw error;
  }

  return { success: true };
}
