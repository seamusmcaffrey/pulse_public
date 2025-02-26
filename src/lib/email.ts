import sgMail from '@sendgrid/mail';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

// Add this constant at the top of the file
const REPLY_DELIMITER = '---pulse-scientific-delimiter---';

interface EmailData {
  expertName: string;
  expertEmail: string;
  articleTitle: string;
  articleId: string;
}

export async function sendInitialEmail(data: EmailData) {
  const token = uuidv4();
  const replyToAddress = `reply+${token}@${process.env.SENDGRID_DOMAIN}`;

  try {
    // First store the token in database
    const { error: tokenError } = await supabase.from('email_tokens').insert([
      {
        token,
        expert_email: data.expertEmail,
        article_id: data.articleId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        max_replies: 0, // 0 means unlimited replies
        reply_count: 0
      },
    ]);

    if (tokenError) {
      console.error('Failed to store token:', tokenError);
      return { error: tokenError };
    }

    // Send email through SendGrid
    const msg = {
      to: data.expertEmail,
      from: `Pulse Scientific <no-reply@${process.env.SENDGRID_DOMAIN}>`,
      replyTo: replyToAddress,
      subject: `Share your thoughts on ${data.articleTitle}`,
      text: `Hi ${data.expertName},

We're gathering expert insights on "${data.articleTitle}", and we'd love your quick take.

Just reply to this email with your thoughts, and your response will be automatically posted in the discussion feed.

Best regards,
The Pulse Scientific Team

${REPLY_DELIMITER}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background-color: #FF69B4; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Pulse Scientific</h1>
    </div>

    <!-- Content -->
    <div style="padding: 24px;">
      <p style="color: #374151; font-size: 16px;">Hi ${data.expertName},</p>
      
      <p style="color: #374151; font-size: 16px;">We're gathering expert insights on:</p>
      
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <a href="https://www.sciencedirect.com/science/article/pii/S2211335518302638" style="color: #1e293b; text-decoration: none; font-size: 18px; font-weight: 600;">${data.articleTitle}</a>
      </div>

      <p style="color: #374151; font-size: 16px;">Your expertise would be invaluable to our scientific community.</p>

      <div style="text-align: center; margin: 32px 0; padding: 24px; background-color: #f8fafc; border-radius: 8px;">
        <div style="font-size: 24px; margin-bottom: 12px;">↓</div>
        <div style="font-size: 18px; font-weight: 500; color: #FF69B4;">Reply to this email to add to the discussion!</div>
        <div style="font-size: 24px; margin-top: 12px;">↓</div>
      </div>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">Best regards,<br>The Pulse Scientific Team</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 16px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">This email was sent by Pulse Scientific. Your insights help advance scientific discourse.</p>
      <div style="display: none;">${REPLY_DELIMITER}</div>
    </div>
  </div>
</body>
</html>`,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
      customArgs: {
        token: token,
        articleId: data.articleId
      }
    };

    await sgMail.send(msg);
    return { success: true, token };
  } catch (error) {
    console.error('Error sending email:', error);
    return { error };
  }
}

export async function handleEmailReply(payload: any) {
  // Extract token from the reply-to address
  const to = payload.to || '';
  const tokenMatch = to.match(/reply\+([a-f0-9-]+)@/);
  
  if (!tokenMatch) {
    console.error('No token found in reply-to address');
    return { error: 'Invalid token' };
  }

  const token = tokenMatch[1];

  // Verify the token and get article info
  const { data: tokenData, error: tokenError } = await supabase
    .from('email_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (tokenError || !tokenData) {
    console.error('Token not found:', tokenError);
    return { error: 'Invalid token' };
  }

  if (tokenData.used) {
    console.error('Token already used');
    return { error: 'Token already used' };
  }

  if (new Date(tokenData.expires_at) < new Date()) {
    console.error('Token expired');
    return { error: 'Token expired' };
  }

  // Extract the comment content from email body
  const content = extractCommentContent(payload.text || '');

  // Store the comment in database
  const { error: commentError } = await supabase.from('comments').insert([
    {
      article_id: tokenData.article_id,
      expert_email: tokenData.expert_email,
      content: content,
    },
  ]);

  if (commentError) {
    console.error('Failed to store comment:', commentError);
    return { error: 'Failed to store comment' };
  }

  // Mark token as used
  await supabase
    .from('email_tokens')
    .update({ used: true })
    .eq('token', token);

  return { success: true };
}

function extractCommentContent(text: string): string {
  if (!text) return '';

  console.log('\n[DEBUG] Starting email parse. Raw text:', text);
  
  // First try to split on obvious email client patterns
  const splitPattern = /\s+On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|[A-Z][a-z]{2}),/i;
  const initialSplit = text.split(splitPattern);
  console.log('[DEBUG] Initial split result:', initialSplit);

  if (initialSplit.length > 1) {
    // If we found a clear email client pattern, take everything before it
    console.log('[DEBUG] Found clear email pattern split, using first part');
    text = initialSplit[0];
  }

  // Split into words and analyze
  const words = text.split(/\s+/);
  console.log('[DEBUG] Analyzing', words.length, 'words');

  // Patterns that indicate we should stop processing
  const stopPatterns = {
    emailClient: /^(?:On|At|From|Sent|To)$/i,
    timeMarker: /^\d{1,2}:\d{2}$/,
    encodedChars: /[\u00e2\u0080\u0098\u009d]/,
    longHash: /^[A-Za-z0-9+\/-]{20,}$/,
    ourFooter: /(?:Pulse|Scientific|insights|advance)/i
  };

  let cleanWords: string[] = [];
  let stopProcessing = false;
  let debugInfo = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    debugInfo = `[DEBUG] Word ${i}: "${word}" `;

    // Check each stop pattern
    for (const [patternName, pattern] of Object.entries(stopPatterns)) {
      if (pattern.test(word)) {
        debugInfo += `matched ${patternName} pattern`;
        console.log(debugInfo);
        
        // If we find a stop pattern, check if we have enough content before it
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
    if (word.length > 0 && !stopPatterns.encodedChars.test(word) && !stopPatterns.longHash.test(word)) {
      cleanWords.push(word);
      debugInfo += '- keeping';
    } else {
      debugInfo += '- skipping';
    }
    
    console.log(debugInfo);
  }

  let result = cleanWords.join(' ').trim();
  console.log('[DEBUG] Final result:', result);

  return result;
}
