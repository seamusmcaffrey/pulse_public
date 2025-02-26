Pulse Scientific Chrome Extension – Extended Documentation

This repository provides a Chrome extension and supporting backend services to overlay expert commentary on research articles. It allows experts to comment via email replies, seamlessly integrated with a custom UI displayed on top of web pages.

Below is a more in-depth explanation of each folder and file, how the system fits together, and how to develop, test, and deploy this project.

Table of Contents
	1.	Introduction
	2.	High-Level Architecture
	3.	Project Structure
	•	Chrome Extension (public/)
	•	UI Components (src/components/ui/)
	•	API & Webhook Handlers (api/)
	•	Scripts (scripts/)
	•	Supabase Database (supabase/)
	•	React App (src/)
	•	Stories (src/stories/)
	•	Configuration & Build Files
	4.	Key Features
	•	1. Email-Based Commenting
	•	2. Expert Verification & Sign-In
	•	3. Research Overlay UI
	5.	Getting Started
	•	Prerequisites
	•	Installation
	•	Running Locally
	•	Developing the Chrome Extension
	6.	Detailed Workflow
	•	Sending Outbound Emails
	•	Processing Inbound Email Replies
	•	Comments and the Supabase Database
	•	Security & Token Expiry
	7.	Deployment & Production
	•	Vercel Deployment for API Routes
	•	SendGrid Setup
	•	Publishing the Chrome Extension
	8.	Testing the Email Flow
	9.	UI Components Reference
	10.	Troubleshooting
	11.	License

Introduction

The Pulse Scientific Chrome Extension provides a collaborative overlay on academic articles, enabling domain experts to comment on research findings directly via email replies. This repository includes:
	•	Frontend: A Chrome extension injected into web pages to display an interactive UI.
	•	Backend: API routes (via Next.js or Vercel serverless functions) that process inbound/outbound emails and store data in a Supabase database.
	•	UI Libraries: A set of reusable UI components (derived from shadcn/ui) for building the overlay.

High-Level Architecture
	1.	Chrome Extension injects a sidebar overlay on research article pages:
	•	Displays expert commentary (fetched from Supabase).
	•	Provides a sign-in flow (Google OAuth) so experts can see specialized content.
	2.	Email-based Comments:
	•	Experts receive a "request for insight" email with a unique token in the reply-to address.
	•	When replying, the inbound webhook (api/inbound.ts) parses the email, validates the token, and stores the response as a comment.
	3.	Supabase:
	•	Stores all experts, comments, email tokens, and email events.
	•	Supports API-based event tracking (api/webhook.ts).
	4.	SendGrid:
	•	Delivers outbound emails requesting commentary.
	•	Receives inbound parse webhooks for replies and event webhooks for email analytics.

Project Structure

Below is a more detailed breakdown of the repository's main folders and files:

Chrome Extension (public/)
	•	public/manifest.json
Defines the Chrome extension. Defines the name, icons, permissions, content scripts, and background scripts. Notable fields:
	•	permissions: Contains "activeTab", "identity", "identity.email" for Google OAuth.
	•	background: Specifies background.js as the Service Worker.
	•	content_scripts: Injects content.js + content.css into <all_urls>.
	•	public/background.js
A background service worker. Handles Google OAuth token retrieval using chrome.identity.getAuthToken(). Responds to messages from the content script.
	•	public/content.js
Injects the main UI overlay into the DOM. Sets up:
	•	Header: A top banner with sign-in, branding, and metadata tags.
	•	Left Sidebar: Expert commentary from Supabase.
	•	Right Sidebar: Social discussion area, toggled with buttons.
	•	Sign-In Flow: Connects to the background script to request the OAuth token.
	•	public/content.css
Styles for the injected overlay (headers, sidebars, toggles, etc.).
	•	Icons (icon16.png, icon48.png, icon128.png)
The extension icons in different resolutions.

UI Components (src/components/ui/)

A large library of reusable UI primitives from the shadcn/ui library. Examples include:
	•	button.tsx – Configurable <Button> component (variants: default, outline, ghost, etc.).
	•	dialog.tsx – Modal dialog, used for advanced popups.
	•	checkbox.tsx, select.tsx, slider.tsx, tabs.tsx, table.tsx, etc.
	•	toast.tsx, use-toast.ts – Toast notifications system.

You can reuse these UI building blocks in your extension's overlay or any React-based frontends.

API & Webhook Handlers (api/)
	•	api/inbound.ts
Main webhook handler for inbound email (SendGrid Inbound Parse).
Steps:
	1.	Determines if it's event tracking or inbound email.
	2.	For inbound email, parses the multipart form data to extract:
	•	to, from, subject, text, html, etc.
	3.	Validates a token from the "reply+@domain" address.
	4.	Stores the comment in Supabase if the token is valid.
	5.	Marks the token as used, preventing reuse.
	•	api/webhook.ts
Handles SendGrid event webhook (e.g., delivered, opened, clicked, etc.). Logs data to the email_events table in Supabase for analytics.
	•	api/types.ts
Contains shared TypeScript definitions for the Vercel request/response objects and any custom payload shapes.
	•	api/test-email.ts
A test endpoint to send a "request for comment" email to a specified address using sendInitialEmail() from src/lib/email.ts.

Scripts (scripts/)
	•	scripts/test-email.ts
A local script that can be run via tsx scripts/test-email.ts. It:
	•	Fetches an expert from Supabase.
	•	Calls sendInitialEmail() to deliver a request-for-comment message.
	•	Demonstrates the flow without requiring a live endpoint to be invoked.

Supabase Database (supabase/)
	•	supabase/migrations/
A set of SQL files that define your database schema:
	•	20240321000000_email_comments.sql: Creates comments, email_tokens, and experts tables.
	•	20240322000000_email_events.sql: Creates an email_events table to store SendGrid event data.
	•	Additional migrations that update schema, RLS policies, add columns, etc.
	•	supabase/config.toml
Supabase CLI config. Defines local dev ports, RLS policies, API usage, etc.
	•	Database Tables:
	1.	experts: Expert profiles with fields like name, email, title, verified, etc.
	2.	comments: Stores user/expert-generated comments. Links back to experts via expert_email and references an article_id.
	3.	email_tokens: Tracks one-time tokens that enable email-based comment replies.
	4.	email_events: Logs inbound/outbound events from SendGrid for debugging and analytics.

React App (src/)
	•	src/App.tsx, src/main.tsx
Boilerplate for a React app. Some routes are used for local dev, though the extension mostly uses content.js for injection.
	•	src/lib/
Shared library logic:
	•	email.ts – Contains sendInitialEmail() to send out requests for commentary (via SendGrid).
	•	webhooks.ts – Helper logic for handling inbound webhooks.
	•	supabase.ts – Creates a Supabase client with your credentials.
	•	utils.ts – Utility functions (e.g., cn() merges Tailwind classes).
	•	src/components/home.tsx
A trivial React component displayed at the base route.
	•	src/index.css
TailwindCSS global styles.

Stories (src/stories/)

A series of Storybook stories for the UI components in src/components/ui/.
Examples:
	•	accordion.stories.tsx, alert-dialog.stories.tsx, etc.
	•	Demonstrate each UI primitive's usage and variant props.

While not strictly required for the extension, these stories are useful for visual testing and UI documentation.

Configuration & Build Files
	•	vite.config.ts – Vite config, uses @vitejs/plugin-react-swc.
	•	tsconfig.json, tsconfig.node.json, tsconfig.server.json – TypeScript configurations for various aspects of the project (client, server, node).
	•	postcss.config.js, tailwind.config.js – Tailwind and PostCSS settings.
	•	.env – Contains environment variables like SENDGRID_API_KEY, VITE_SUPABASE_URL, etc.

Key Features

1. Email-Based Commenting
	•	Request Email: Use sendInitialEmail() to ask an expert for comments.
	•	Reply Parsing: The api/inbound.ts webhook extracts the token from the reply+<token>@domain address, then stores the reply as a new comment record.
	•	One-Time Tokens: Each inbound token is single-use, ensuring controlled comment insertion.

2. Expert Verification & Sign-In
	•	Google OAuth: background.js obtains an OAuth token for the user.
	•	Overlay: Once signed in, additional UI elements become interactive (e.g., "Reply", "Helpful" buttons).

3. Research Overlay UI
	•	The extension injects an overlay with:
	•	Metadata tags (sample size, duration, effect size).
	•	Expert Commentary (left sidebar).
	•	Social Discussion (right sidebar).
	•	Toggle Buttons to hide/show sidebars.

Getting Started

Prerequisites
	1.	Node.js (v16+ recommended).
	2.	npm or yarn for package management.
	3.	A SendGrid account with an API key (and domain verified).
	4.	A Supabase project with credentials for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
	5.	Optionally, the Supabase CLI for local migrations.

Installation

git clone https://github.com/YourOrg/pulsev3.git
cd pulsev3
npm install

Running Locally

# Start local dev server
npm run dev

This command will run the Vite server, which you can use for local UI or Storybook-like testing. The extension itself still needs to be loaded into Chrome manually (see next section).

Developing the Chrome Extension
	1.	Build the extension:

npm run build

This outputs a dist/ folder containing the manifest, scripts, and any compiled code.

	2.	Load the extension into Chrome:
	•	Open chrome://extensions/
	•	Enable "Developer mode"
	•	Click "Load unpacked" and select the dist/ folder.
	3.	Visit any webpage to see the overlay (injected via content.js).

Detailed Workflow

Sending Outbound Emails
	•	Use sendInitialEmail() from src/lib/email.ts to send a request for commentary.
	•	An email token is created and stored in the email_tokens table.
	•	The token is embedded in the replyTo address as reply+<token>@<SENDGRID_DOMAIN>.

Processing Inbound Email Replies
	•	SendGrid's Inbound Parse forwards the entire email to api/inbound.ts.
	•	The code checks to and looks for reply+<token>@....
	•	If valid and not expired, a new comment is stored in the comments table.

Comments and the Supabase Database
	•	comments table references expert_email and an article_id.
	•	Each inbound comment row can store additional metadata: message_id, dkim, spf, raw_headers, etc.
	•	RLS (Row Level Security) ensures the data remains protected, but can be selectively read.

Security & Token Expiry
	•	Single-use: Once used, a token in email_tokens is marked as used.
	•	Expiry: Tokens typically expire after 7 days. This logic is set upon creation in sendInitialEmail().

Deployment & Production

Vercel Deployment for API Routes
1. Initial Setup (one-time only):
   - Link the repo to Vercel: `vercel link`
   - Configure environment variables in Vercel Dashboard:
     - SENDGRID_API_KEY
     - SENDGRID_DOMAIN
     - VITE_SUPABASE_URL
     - VITE_SUPABASE_ANON_KEY

2. Ongoing Deployments:
   - Deployments happen automatically when changes are pushed to the main branch
   - No need to run deploy commands manually
   - Vercel will build and deploy based on Git updates

The api/ folder's .ts files become serverless functions.

SendGrid Setup
	1.	Domain Authentication: Prove domain ownership (DKIM, SPF).
	2.	Inbound Parse:
	•	Set the "Host" or "Endpoint" to your Vercel domain plus /api/inbound.
	•	Use raw MIME parse (multipart/form-data).
	3.	Event Webhook:
	•	Configure an endpoint for api/webhook.

Publishing the Chrome Extension
	1.	Build the extension: npm run build.
	2.	Zip the dist/ folder contents.
	3.	Upload to the Chrome Web Store Developer Dashboard.

Testing the Email Flow
	1.	Send a test email (either from your local environment or via the /api/test-email endpoint).
Example:

tsx scripts/test-email.ts

This sends a test "request for comment" to the specified address.

	2.	Reply to that email from the expert's inbox.
	3.	Check logs on Vercel (for inbound parse success) or run locally if you have your dev environment set up with a tunneling service.
	4.	Verify the new comment appears in your Supabase comments table and in the UI overlay.

UI Components Reference

The src/components/ui/ folder is a curated library from shadcn/ui. Notable components:
	•	Alerts (alert.tsx), Dialogs (dialog.tsx)
Provide user notifications or confirmations.
	•	Forms (form.tsx, input.tsx, textarea.tsx, checkbox.tsx)
Helpers for building accessible forms.
	•	Overlays (popover.tsx, hover-card.tsx, tooltip.tsx)
UI that appears on hover or click.
	•	Data Display (table.tsx, badge.tsx, progress.tsx, skeleton.tsx)
Quickly show tabular data, statuses, or placeholders.

For usage examples, see the stories in src/stories/.

Troubleshooting
	1.	No Emails Sent
	•	Check .env for correct SENDGRID_API_KEY.
	•	Verify domain is authenticated in SendGrid.
	2.	Inbound Webhook Failing
	•	Confirm the SendGrid Inbound Parse is configured with the correct POST endpoint.
	•	Check Vercel function logs for errors.
	3.	Tokens Not Found or Already Used
	•	Possibly the token is expired or used. Generate a new one.
	4.	Comments Not Appearing
	•	Make sure the article_id in your UI matches the article_id used in the token.

License

This project is proprietary to [YourOrganization]. For inquiries about usage, please contact [YourOrganization Support]. You may also include any open-source licensing disclaimers here if applicable.

Thank you for using the Pulse Scientific Chrome Extension! If you have questions, suggestions, or need further assistance, feel free to open an issue or contact the maintainers.