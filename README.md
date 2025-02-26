# Pulse Scientific Chrome Extension

## Overview

The Pulse Scientific Chrome Extension adds an interactive overlay to research articles, providing expert commentary and social discussion features. The extension creates a collaborative environment where insights can be shared directly on research papers.

## Key Features

### 1. Research Metadata Display
- **Study Information**: Clear visualization of key study metrics
  - Sample size and demographics
  - Study duration
  - Effect size
  - Research design
  - Rigor assessment

### 2. Expert Commentary
- **Left Sidebar**: Displays verified expert comments
- **Verification Badges**: Visual indicators for verified experts
- **Engagement Features**: Like and reply functionality
- **Demo Mode**: Pre-loaded expert comments for demonstration

### 3. Social Discussion
- **Right Sidebar**: Community discussion and trending research
- **Comment System**: User-friendly interface for posting comments
- **Trending Section**: Highlights popular research papers
- **Engagement Metrics**: Shows likes and replies for each comment

### 4. Modern UI/UX
- **Clean Interface**: Non-intrusive overlay design
- **Responsive Layout**: Adapts to different screen sizes
- **Visual Hierarchy**: Clear distinction between expert and social content
- **Interactive Elements**: Hover states and action buttons

## Project Structure

```
pulsev3/
├── public/
│   ├── manifest.json      # Extension manifest
│   ├── content.js         # Main overlay injection script
│   ├── content.css        # Overlay styles
│   ├── background.js      # Service worker for auth
│   ├── config.js          # Demo data configuration
│   └── icons/            # Extension icons
├── scripts/
│   └── build-extension-simple.js  # Build script
└── package.json          # Project dependencies
```

## Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- npm (latest version)
- Chrome browser

### Installation

```bash
# Clone the repository
git clone https://github.com/seamusmcaffrey/pulse_public
cd pulse_public

# Install dependencies
npm install
```

### Development

```bash
# Build the extension
npm run build:all
```

### Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` directory
4. The extension should now appear in your browser

## Development Best Practices

1. **Build Process**
   - Always use `npm run build:all` for complete builds
   - Verify the contents of the `dist/` directory after building

2. **Testing Changes**
   - After making changes, run a complete build
   - Reload the extension in Chrome's extension manager
   - Clear browser cache if needed
   - Check the browser console for any errors

3. **Code Organization**
   - Keep content script modifications in `public/content.js`
   - Background script logic belongs in `public/background.js`
   - Styles should be in `public/content.css`
   - Demo data configuration in `public/config.js`

## UI Components

### Header
- Pink-themed header bar with Pulse logo
- Metadata tags showing study information
- Google sign-in integration

### Expert Commentary
- Left sidebar with verified expert comments
- Expert profiles with avatars and titles
- Engagement metrics and actions

### Social Discussion
- Right sidebar with community comments
- Comment composition interface
- Trending research section with rankings

### Styling
- CSS variables for consistent theming
- Responsive layout adjustments
- Modern scrollbar styling
- Interactive hover states
