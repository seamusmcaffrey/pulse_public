# Pulse Scientific Chrome Extension

## Overview

The Pulse Scientific Chrome Extension adds an interactive overlay to research articles, allowing verified experts to provide commentary via email replies. The extension creates a collaborative environment where scientific insights can be shared directly on research papers.

## Project Goals

- Create a seamless way for experts to comment on scientific articles without requiring account creation
- Enhance research papers with contextual expert commentary
- Build a community around scientific discussion
- Provide an intuitive overlay experience that works across different research sites

## Key Features

### 1. Email-Based Commenting System

- **Simple Commenting**: Experts receive email requests for commentary and can reply directly to share insights
- **Single-Use Tokens**: Each email contains a unique token that enables secure, verified replies
- **Token Expiration**: Tokens expire after 7 days to maintain security
- **Reply Processing**: Inbound email webhook parses replies and stores them as comments

### 2. Chrome Extension Overlay

- **Sidebar Integration**: Non-intrusive overlay appears on research pages
- **Expert Commentary**: Left sidebar displays verified expert comments
- **Social Discussion**: Right sidebar enables community discussion
- **Toggleable Interface**: Users can hide/show sidebars as needed

### 3. Expert Verification

- **Google OAuth**: Sign-in via Google accounts for experts
- **Profile Management**: Expert profiles with verification status
- **Email Verification**: Email-based token verification ensures comment authenticity

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- npm or yarn
- Supabase account and project
- SendGrid account with API key and verified domain
- Chrome browser (for extension development)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/pulse-scientific.git
cd pulse-scientific

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your SendGrid and Supabase credentials
```

### Environment Variables

Create a `.env` file with the following:

```
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_DOMAIN=your_verified_domain.com
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Development

### Running Locally

```bash
# Start development server
npm run dev
```

### Building the Extension

```bash
# Build the extension for production
npm run build
```

### Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` directory from your project
4. The extension should now appear in your browser

## Testing the Email Flow

### Sending a Test Email

Use the provided test script to send an email to a specified expert:

```bash
# Run the test email script
npm run test:email
```

This script:
1. Creates a one-time token in Supabase
2. Embeds the token in the reply-to address
3. Sends a test email requesting commentary
4. Returns the token ID for tracking

### Testing the Reply Flow

1. Wait for the test email to arrive
2. Reply with your test comment
3. The system will process your reply, strip quoted content, and store it as a comment
4. View the comment in the extension overlay (may require refreshing the page)

## Deployment

### Vercel Deployment for API Routes

- Deployments happen automatically when changes are pushed to the main branch
- No need to run deploy commands manually

### Chrome Extension Publishing

1. Build the extension: `npm run build`
2. Zip the contents of the `dist/` directory
3. Upload to the Chrome Web Store

## Project Structure

### Core Components

- `/public/`: Chrome extension files (manifest.json, background.js, content.js)
- `/api/`: Serverless API functions for handling webhooks and emails
- `/src/`: React components and shared libraries
- `/supabase/`: Database migrations and configurations

### Key Files

- `public/content.js`: Injects the overlay UI into research pages
- `api/inbound.ts`: Processes inbound email replies from experts
- `src/lib/email.ts`: Handles email generation and token creation
- `public/background.js`: Manages Google OAuth and extension background services

## Database Structure

The project uses Supabase with the following main tables:

- `comments`: Stores expert comments with links to articles
- `email_tokens`: Tracks one-time tokens for email verification
- `experts`: Contains expert profiles and verification status
- `email_events`: Logs email delivery events from SendGrid

## Troubleshooting

### Email Flow Issues

- **Email not received**: Check SendGrid API key and domain verification
- **Token errors**: Ensure the expert email exists in the experts table
- **Comment not appearing**: Verify the article ID exists in the database
- **Parsing issues**: Check the API logs for inbound.ts errors

### Extension Issues

- **Overlay not appearing**: Ensure the extension is properly loaded and active
- **Sign-in problems**: Check Google OAuth configuration in manifest.json
- **Content loading slowly**: Consider optimizing comment fetching logic

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Commit your changes: `git commit -m 'Add feature'`
4. Push to your branch: `git push origin my-feature`
5. Open a pull request

