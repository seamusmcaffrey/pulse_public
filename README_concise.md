# Pulse Scientific Chrome Extension

A Chrome extension that adds a scientific community overlay to research papers, allowing experts to comment and discuss via email.

## Project Structure

### Chrome Extension Files
- `/public/`
  - `manifest.json` - Extension configuration
  - `background.js` - Background service worker for auth
  - `content.js` - Injects the overlay UI
  - `content.css` - Styles for the overlay
  - `icon*.svg` - Extension icons

### API & Backend
- `/api/`
  - `webhook.ts` - SendGrid webhook handler for email replies
  - `types.ts` - TypeScript types for API requests/responses

### Core Functionality
- `/src/lib/`
  - `email.ts` - Email sending logic using SendGrid
  - `webhooks.ts` - Email reply processing
  - `supabase.ts` - Database client setup
  - `types.ts` - Shared TypeScript interfaces

### Database (Supabase)
Tables:
- `email_tokens` - Tracks email reply tokens
- `comments` - Stores expert comments
- `experts` - Expert profiles and verification

## Key Features

### 1. Email-Based Commenting
- Experts receive emails requesting comments
- Reply-to-comment functionality
- Comment editing via email replies

### 2. Expert Verification
- Google Sign-in integration
- Expert profile management
- Citation metrics tracking

### 3. UI Overlay
- Research metadata display
- Expert commentary feed
- Social discussion section

## Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_SENDGRID_API_KEY=your_sendgrid_key
VITE_SENDGRID_WEBHOOK_SECRET=your_webhook_secret
```

## Deployment

### Vercel API Deployment
1. Install Vercel CLI: `npm install -g vercel` (one-time setup)
2. Login: `vercel login` (one-time setup)
3. Link project: `vercel link` (one-time setup)
4. Deployments happen automatically when changes are pushed to the main branch
   - No need to run deploy commands manually
   - Vercel will build and deploy based on Git updates

### SendGrid Setup
1. Configure domain authentication
2. Set up inbound parse webhook
3. Add MX records for email receiving
4. Configure event webhook

### Chrome Extension Publishing
1. Build extension: `npm run build`
2. Zip contents of `dist` directory
3. Upload to Chrome Web Store

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Testing Email Flow

1. Send initial email:
```typescript
const result = await sendInitialEmail({
  expertName: "Test Expert",
  expertEmail: "expert@example.com",
  articleTitle: "Test Article",
  articleId: "test123"
});
```

2. Expert replies to email
3. SendGrid webhook processes reply
4. Comment appears in overlay

## Security Notes

- Webhook signatures are verified
- Email tokens expire after 7 days
- Google OAuth for expert verification
- Rate limiting on API endpoints
