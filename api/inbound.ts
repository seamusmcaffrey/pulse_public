// Export config to handle multipart form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

import type { VercelRequest, VercelResponse } from "./types";
import getRawBody from 'raw-body';
import { createHmac } from 'crypto';
import { stripHtml } from 'string-strip-html';
import { v4 as uuidv4 } from 'uuid';

// Required fields for email processing
const REQUIRED_FIELDS = ['to', 'from', 'subject', 'email'];
const CONTENT_FIELDS = ['text', 'html', 'email'];
const MAX_BODY_SIZE = '10mb';
const SAFE_PREVIEW_LENGTH = 500;

// Webhook types
const WEBHOOK_TYPES = {
  INBOUND_PARSE: 'inbound_parse',
  EVENT_TRACKING: 'event_tracking',
} as const;

interface EmailData {
  to?: string;
  from?: string;
  subject?: string;
  text?: string;
  html?: string;
  email?: string;
  envelope?: string;
  headers?: { [key: string]: string };
  attachments?: {
    [key: string]: {
      filename: string;
      content: Buffer;
      contentType: string;
    };
  };
  [key: string]: any;
}

interface ProcessedPart {
  headers: { [key: string]: string };
  content: string;
  name?: string;
  filename?: string;
}

interface EventData {
  articleId?: string;
  email?: string;
  event?: string;
  sg_event_id?: string;
  sg_message_id?: string;
  token?: string;
  timestamp?: number;
}

// Helper function to determine webhook type
function determineWebhookType(headers: any, contentType: string): typeof WEBHOOK_TYPES[keyof typeof WEBHOOK_TYPES] {
  if (contentType?.includes('multipart/form-data')) {
    return WEBHOOK_TYPES.INBOUND_PARSE;
  }
  return WEBHOOK_TYPES.EVENT_TRACKING;
}

// Helper function to extract email content from raw email
function extractEmailContent(rawEmail: string): string {
  // Split by MIME boundaries
  const parts = rawEmail.split(/--[a-zA-Z0-9]+/);
  
  // Find the text/plain part
  for (const part of parts) {
    if (part.includes('Content-Type: text/plain')) {
      // Get content after headers
      const contentParts = part.split('\n\n');
      if (contentParts.length >= 2) {
        console.log('[DEBUG] Found text/plain part, extracting content');
        let content = contentParts.slice(1).join('\n\n');

        // First try to split on obvious email client patterns
        const splitPattern = /\s+On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|[A-Z][a-z]{2}),/i;
        const initialSplit = content.split(splitPattern);
        console.log('[DEBUG] Initial split result:', initialSplit);

        if (initialSplit.length > 1) {
          // If we found a clear email client pattern, take everything before it
          console.log('[DEBUG] Found clear email pattern split, using first part');
          content = initialSplit[0];
        }

        // Split into words and analyze
        const words = content.split(/\s+/);
        console.log('[DEBUG] Analyzing', words.length, 'words');

        // Patterns that indicate we should stop processing
        const stopPatterns = {
          emailClient: /^(?:On|At|From|Sent|To)$/i,
          timeMarker: /^\d{1,2}:\d{2}$/,
          encodedChars: /[\u00e2\u0080\u0098\u009d]/,
          longHash: /^[A-Za-z0-9+/=_-]{20,}$/,
          ourFooter: /(?:Pulse|Scientific|insights|advance)/i,
          quoteMarker: /^>|wrote:|Content-|From:|To:|Subject:|Date:|Cc:/i,
          encodedContent: /^[-+.=_2]{10,}/,
          base64Like: /^[a-zA-Z0-9+/=]{30,}$/
        };

        let cleanWords: string[] = [];
        let stopProcessing = false;

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          let debugInfo = `[DEBUG] Word ${i}: "${word}" `;

          // Check each stop pattern
          for (const [patternName, pattern] of Object.entries(stopPatterns)) {
            if (pattern.test(word)) {
              debugInfo += `matched ${patternName} pattern`;
              console.log(debugInfo);
              
              // If we find a stop pattern and have content, stop processing
              if (cleanWords.length > 0) {
                stopProcessing = true;
                break;
              }
            }
          }

          if (stopProcessing) {
            console.log('[DEBUG] Stopping processing at word:', word);
            break;
          }

          // If the word looks clean, keep it
          if (word.length > 0 && 
              !stopPatterns.encodedChars.test(word) && 
              !stopPatterns.longHash.test(word) &&
              !stopPatterns.base64Like.test(word) &&
              !stopPatterns.encodedContent.test(word)) {
            cleanWords.push(word);
            debugInfo += '- keeping';
          } else {
            debugInfo += '- skipping';
          }
          
          console.log(debugInfo);
        }

        let result = cleanWords.join(' ').trim();
        console.log('[DEBUG] Final cleaned result:', result);

        // If using quoted-printable encoding, decode it
        if (part.includes('quoted-printable')) {
          result = result
            .replace(/=\r?\n/g, '')
            .replace(/=([0-9A-F]{2})/gi, (_, p1) => 
              String.fromCharCode(parseInt(p1, 16)));
        }

        return result;
      }
    }
  }
  return '';
}

// Helper function to process event tracking webhook
async function handleEventTracking(body: any[], correlationId: string): Promise<void> {
  for (const event of body) {
    console.log(`[${correlationId}] Processing event:`, {
      event_type: event.event,
      sg_event_id: event.sg_event_id,
      token: event.token,
      timestamp: new Date(event.timestamp * 1000).toISOString()
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const correlationId = uuidv4();
  console.log(`=== Starting webhook handler [${correlationId}] ===`);
  console.log("Timestamp:", new Date().toISOString());
  console.log("Version: Connected via new repository (pulsev3)");
  
  if (req.method !== "POST") {
    console.error(`[${correlationId}] Invalid method:`, req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Log request headers for debugging
    console.log(`[${correlationId}] Headers:`, JSON.stringify(req.headers, null, 2));
    
    const contentType = req.headers['content-type'] || '';
    
    // Determine webhook type
    const webhookType = determineWebhookType(req.headers, contentType);
    console.log(`[${correlationId}] Webhook type:`, webhookType);

    // Handle event tracking webhook
    if (webhookType === WEBHOOK_TYPES.EVENT_TRACKING) {
      const rawBody = await getRawBody(req, {
        length: req.headers['content-length'],
        limit: MAX_BODY_SIZE,
        encoding: 'utf8'
      });
      
      const eventBody = JSON.parse(rawBody);
      console.log(`[${correlationId}] Event tracking body:`, eventBody);
      
      await handleEventTracking(eventBody, correlationId);
      return res.status(200).json({ 
        message: 'Event tracking webhook processed',
        correlation_id: correlationId
      });
    }

    // From here on, we're processing an inbound parse webhook
    console.log(`[${correlationId}] Processing inbound parse webhook`);
    
    // Validate content type
    if (!contentType.includes('multipart/form-data')) {
      console.error(`[${correlationId}] Invalid content type:`, contentType);
      return res.status(400).json({ error: "Invalid content type: expected multipart/form-data" });
    }

    console.log(`[${correlationId}] === Getting raw body ===`);
    // Get the raw body as a string with enhanced error handling
    const rawBody = await getRawBody(req, {
      length: req.headers['content-length'],
      limit: MAX_BODY_SIZE,
      encoding: true
    }).catch(err => {
      console.error(`[${correlationId}] Error getting raw body:`, err);
      throw new Error(`Failed to read request body: ${err.message}`);
    });

    console.log(`[${correlationId}] Raw body received, length:`, rawBody.length);
    console.log(`[${correlationId}] First ${SAFE_PREVIEW_LENGTH} chars of raw body:`, rawBody.substring(0, SAFE_PREVIEW_LENGTH));

    // Parse the multipart form data manually
    let emailData: EmailData = {};
    
    console.log(`[${correlationId}] === Extracting boundary ===`);
    // Extract boundary from content-type header with enhanced validation
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;
    
    if (!boundary) {
      console.error(`[${correlationId}] No boundary found in content-type:`, contentType);
      return res.status(400).json({ error: 'Invalid content-type: no boundary found' });
    }

    // Verify boundary exists in body
    if (!rawBody.includes(boundary)) {
      console.error(`[${correlationId}] Boundary not found in raw body`);
      return res.status(400).json({ error: 'Invalid request: boundary not found in body' });
    }

    console.log(`[${correlationId}] Found boundary:`, boundary);

    console.log(`[${correlationId}] === Splitting parts ===`);
    // Split the body into parts using the boundary with enhanced line ending handling
    const normalizedBody = rawBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = normalizedBody.split(`--${boundary}`);
    console.log(`[${correlationId}] Number of parts found:`, parts.length);

    // Enhanced part logging
    parts.forEach((part, index) => {
      const preview = part.substring(0, 100).replace(/\n/g, '\\n');
      console.log(`[${correlationId}] Part ${index} preview: ${preview}`);
    });

    console.log(`[${correlationId}] === Processing parts ===`);
    // Process each part with enhanced validation
    for (const part of parts) {
      if (!part.trim() || part === '--') continue;  // Skip empty parts and ending boundary
      
      try {
        const processedPart = processEmailPart(part.trim(), correlationId);
        if (!processedPart) continue;

        const { name, content, filename } = processedPart;
        
        if (!name) {
          console.warn(`[${correlationId}] Part found without name attribute`);
          continue;
        }

        if (filename) {
          // Handle attachment
          console.log(`[${correlationId}] Processing attachment: ${filename}`);
          if (!emailData.attachments) emailData.attachments = {};
          emailData.attachments[name] = {
            filename,
            content: Buffer.from(content, 'binary'),
            contentType: processedPart.headers['content-type'] || 'application/octet-stream'
          };
        } else {
          // Handle regular field
          emailData[name] = content;
          console.log(`[${correlationId}] Processed field ${name} (length: ${content.length})`);
          if (content.length < 100) {
            console.log(`[${correlationId}] Field ${name} value: ${content}`);
          }
        }
      } catch (err) {
        console.error(`[${correlationId}] Error processing part:`, err);
        // Continue processing other parts
      }
    }

    // When processing the email field
    if (emailData.email) {
      console.log(`[${correlationId}] Processing raw email content`);
      const emailContent = extractEmailContent(emailData.email);
      if (emailContent) {
        emailData.text = emailContent;
        console.log(`[${correlationId}] Extracted email content length:`, emailContent.length);
        console.log(`[${correlationId}] First 200 chars of content:`, emailContent.substring(0, 200));
      }
    }

    console.log(`[${correlationId}] === Validating fields ===`);
    // Enhanced field validation
    const missingFields = REQUIRED_FIELDS.filter(field => !emailData[field]);
    if (missingFields.length > 0) {
      console.error(`[${correlationId}] Missing required fields:`, missingFields);
      console.error(`[${correlationId}] Available fields:`, Object.keys(emailData));
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Enhanced content validation
    const hasContent = CONTENT_FIELDS.some(field => {
      const content = emailData[field];
      return typeof content === 'string' && content.trim().length > 0;
    });

    if (!hasContent) {
      console.error(`[${correlationId}] No valid content found in email`);
      console.error(`[${correlationId}] Available fields:`, Object.keys(emailData));
      console.error(`[${correlationId}] Email field length:`, emailData.email?.length);
      return res.status(400).json({ error: 'No valid content found in email' });
    }

    // Process HTML content if present
    if (emailData.html) {
      emailData.html = stripHtml(emailData.html).result;
    }

    console.log(`[${correlationId}] === Processing email data ===`);
    console.log(`[${correlationId}] Email structure:`, {
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject,
      textLength: emailData.text?.length || 0,
      htmlLength: emailData.html?.length || 0,
      attachmentCount: emailData.attachments ? Object.keys(emailData.attachments).length : 0,
      allFields: Object.keys(emailData)
    });

    // Enhanced envelope parsing
    let parsedEnvelope: any = null;
    if (emailData.envelope) {
      try {
        parsedEnvelope = JSON.parse(emailData.envelope);
        console.log(`[${correlationId}] Parsed envelope:`, parsedEnvelope);
      } catch (err) {
        console.warn(`[${correlationId}] Failed to parse envelope:`, err);
      }
    }

    // Enhanced recipient determination
    const toField = emailData.to ||
                    (parsedEnvelope?.to?.[0]) ||
                    emailData.recipient ||
                    '';
    
    console.log(`[${correlationId}] === Processing recipient ===`);
    console.log(`[${correlationId}] To field:`, toField);
    
    if (!toField) {
      console.error(`[${correlationId}] No recipient found`);
      return res.status(400).json({ error: 'No recipient found' });
    }

    // Enhanced token extraction with case-insensitive matching
    const tokenMatch = toField.match(/reply\+([a-zA-Z0-9-]+)@/i);
    if (!tokenMatch) {
      console.error(`[${correlationId}] Invalid token format in recipient:`, toField);
      return res.status(400).json({ error: 'Invalid token format in recipient address' });
    }

    const token = tokenMatch[1].toLowerCase();  // Normalize token to lowercase
    console.log(`[${correlationId}] Extracted token:`, token);

    // Enhanced token verification
    console.log(`[${correlationId}] === Verifying token ===`);
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error(`[${correlationId}] Missing Supabase configuration`);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const tokenResponse = await fetch(`${supabaseUrl}/rest/v1/email_tokens?token=eq.${token}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!tokenResponse.ok) {
      console.error(`[${correlationId}] Failed to query token:`, tokenResponse.statusText);
      return res.status(500).json({ error: 'Failed to verify token' });
    }

    const tokenData = await tokenResponse.json();
    console.log(`[${correlationId}] Token verification response:`, tokenData);

    if (!tokenData || !tokenData[0]) {
      console.error(`[${correlationId}] Token not found in database`);
      return res.status(400).json({ error: 'Invalid token' });
    }

    const tokenRecord = tokenData[0];

    // Check reply limits
    if (tokenRecord.max_replies > 0 && tokenRecord.reply_count >= tokenRecord.max_replies) {
      console.error(`[${correlationId}] Token has reached maximum reply limit`);
      return res.status(400).json({ error: 'Maximum replies reached for this token' });
    }

    const expiryDate = new Date(tokenRecord.expires_at);
    if (expiryDate < new Date()) {
      console.error(`[${correlationId}] Token expired at:`, expiryDate);
      return res.status(400).json({ error: 'Token expired' });
    }

    // Extract the email content
    let emailContent = emailData.text || emailData.html || '';
    if (typeof emailData.html === 'string') {
      // Strip HTML tags if we're using the HTML content
      emailContent = emailData.html.replace(/<[^>]*>/g, '');
    }

    // Clean up the content with enhanced filtering
    let content = emailContent
      .split('\n')
      .filter(line => {
        const trimmedLine = line.trim();
        return trimmedLine && // Remove empty lines
               !line.startsWith('>') && // Remove quoted text
               !line.match(/On.*wrote:/) && // Remove email client quotes
               !line.match(/^Sent from/) && // Remove email signatures
               !line.match(/^--$/) && // Remove signature delimiters
               !line.match(/^>?\s*From:.*$/) && // Remove forwarded message headers
               !line.match(/^>?\s*Date:.*$/); // Remove forwarded date headers
      })
      .join('\n')
      .trim();

    if (!content) {
      console.error(`[${correlationId}] No content found in email after cleaning. Full email data:`, JSON.stringify(emailData, null, 2));
      return res.status(400).json({ error: 'No content found' });
    }

    console.log(`[${correlationId}] Processed content:`, content);

    // Fetch expert's signature from database
    const expertEmail = tokenRecord.expert_email;
    const expertResponse = await fetch(
      `${supabaseUrl}/rest/v1/experts?select=signature&email=eq.${encodeURIComponent(expertEmail)}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (!expertResponse.ok) {
      console.error(`[${correlationId}] Failed to fetch expert signature:`, await expertResponse.text());
      // Continue without signature removal if we can't fetch it
    } else {
      const expertData = await expertResponse.json();
      if (expertData?.[0]?.signature) {
        console.log(`[${correlationId}] Found expert signature:`, expertData[0].signature);
        // Remove the expert's signature from the content
        const signature = expertData[0].signature;
        const contentWithoutSignature = content.replace(signature, '').trim();
        if (contentWithoutSignature) {
          console.log(`[${correlationId}] Removed expert signature from content`);
          content = contentWithoutSignature;
        }
      }
    }

    // When processing the token and before storing the comment, add idempotency check
    const messageId = emailData.headers?.['message-id'] || '';
    const idempotencyKey = `${token}_${messageId}`;
    
    // Check if we've already processed this email
    let existingCommentQuery = `${supabaseUrl}/rest/v1/comments?select=id&token=eq.${encodeURIComponent(token)}`;
    if (messageId) {
      existingCommentQuery += `&message_id=eq.${encodeURIComponent(messageId)}`;
    }
    
    const existingCommentResponse = await fetch(
      existingCommentQuery,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=minimal'
        }
      }
    );

    if (!existingCommentResponse.ok) {
      console.error(`[${correlationId}] Failed to check for existing comment:`, await existingCommentResponse.text());
      return res.status(500).json({ error: 'Failed to verify idempotency' });
    }

    const existingComments = await existingCommentResponse.json();
    if (existingComments && existingComments.length > 0) {
      console.log(`[${correlationId}] Comment already processed for token ${token} and message ID ${messageId}`);
      return res.status(200).json({ message: 'Comment already processed' });
    }

    // When storing the comment, clean the content one final time
    const cleanContent = content
      .split('\n')
      .filter(line => {
        const trimmedLine = line.trim();
        // Final pass to catch any remaining artifacts
        return trimmedLine &&
               // Remove any remaining encoded-looking content
               !trimmedLine.match(/^[a-zA-Z0-9+/=_-]{30,}$/) &&
               // Remove lines that are mostly numbers and special chars
               !trimmedLine.match(/^[-+.=_2]{10,}/) &&
               // Remove any remaining email client artifacts
               !trimmedLine.match(/^>|wrote:|Content-|From:|To:|Subject:|Date:|Cc:/i);
      })
      .join('\n')
      .trim();

    // Update the comment data to use the cleaned content
    const commentData = {
      article_id: tokenRecord.article_id,
      expert_email: tokenRecord.expert_email,
      content: cleanContent, // Use the cleaned content
      token: token,
      message_id: messageId,
      correlation_id: correlationId,
      webhook_type: webhookType,
      processed_at: new Date().toISOString(),
      dkim: emailData.dkim,
      spf: emailData.SPF,
      sender_ip: emailData.sender_ip,
      raw_headers: JSON.stringify(emailData.headers)
    };

    // Store the comment with additional metadata
    const commentResponse = await fetch(`${supabaseUrl}/rest/v1/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'  // Request the created record back
      },
      body: JSON.stringify(commentData)
    });

    const responseText = await commentResponse.text();
    console.log(`[${correlationId}] Raw comment response:`, responseText);

    if (!commentResponse.ok) {
      console.error(`[${correlationId}] Failed to store comment:`, responseText);
      return res.status(500).json({ error: 'Failed to store comment' });
    }

    let commentResult;
    try {
      commentResult = JSON.parse(responseText);
      console.log(`[${correlationId}] Comment stored successfully:`, commentResult);
    } catch (error) {
      console.error(`[${correlationId}] Failed to parse comment response:`, error);
      return res.status(500).json({ error: 'Failed to parse comment response' });
    }

    // Update token reply count instead of marking as used
    await fetch(`${supabaseUrl}/rest/v1/email_tokens?token=eq.${token}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ 
        reply_count: (tokenRecord.reply_count || 0) + 1,
        processed_at: new Date().toISOString(),
        correlation_id: correlationId
      })
    });

    return res.status(200).json({ 
      message: 'Email processed successfully',
      correlation_id: correlationId,
      webhook_type: webhookType
    });

  } catch (error) {
    console.error(`[${correlationId}] Unexpected error:`, error);
    return res.status(500).json({ error: 'Internal server error', correlation_id: correlationId });
  }
}

// Helper function to process email parts
function processEmailPart(part: string, correlationId: string): ProcessedPart | null {
  const sections = part.split('\n\n');
  if (sections.length < 2) {
    console.warn(`[${correlationId}] Part has insufficient sections`);
    return null;
  }

  const [headerSection, ...contentSections] = sections;
  const content = contentSections.join('\n\n').trim();
  
  // Parse headers
  const headers: { [key: string]: string } = {};
  headerSection.split('\n').forEach(line => {
    const [key, ...values] = line.split(':');
    if (key && values.length) {
      headers[key.trim().toLowerCase()] = values.join(':').trim();
    }
  });

  // Extract name and filename from Content-Disposition
  const contentDisposition = headers['content-disposition'] || '';
  const nameMatch = contentDisposition.match(/name="([^"]+)"/);
  const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);

  return {
    headers,
    content,
    name: nameMatch?.[1],
    filename: filenameMatch?.[1]
  };
} 