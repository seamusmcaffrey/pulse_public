# Pulse Scientific Overlay

## Overview

A lightweight overlay for research articles that displays study metadata, expert commentary, and trending research. The overlay provides a clean, non-intrusive interface for viewing research context and expert insights.

## Key Features

### 1. Research Metadata Display
- Sample size and demographics
- Study duration
- Effect size
- Research design
- Rigor assessment

### 2. Expert Commentary
- Left sidebar with expert insights
- Expert profiles with avatars
- Verification badges for experts
- Timestamp display

### 3. Trending Research
- Curated list of related papers
- Journal references
- Quick access to popular research

### 4. Modern UI/UX
- Clean, minimal interface
- Responsive layout
- Interactive hover states
- Consistent visual hierarchy

## Project Structure

```
pulse-scientific-overlay/
├── public/
│   ├── content.js         # Main overlay injection script
│   ├── content.css        # Overlay styles
│   ├── config.js          # Demo data configuration
│   ├── manifest.json      # Extension manifest
│   └── icons/            # Extension icons
├── src/
│   ├── components/ui/    # UI components
│   │   ├── button.tsx    # Button component
│   │   ├── dialog.tsx    # Modal dialogs
│   │   └── hover-card.tsx # Tooltips
│   ├── utils/           # Utility functions
│   │   └── utils.ts     # Tailwind utilities
│   └── index.css        # Tailwind setup
└── package.json         # Dependencies
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
cd pulse-scientific-overlay

# Install dependencies
npm install
```

### Development

```bash

# Build for production
npm run build

```

### Loading in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` directory
4. The extension should appear in your browser

## Development Guidelines

### 1. Component Structure
- UI components are in `src/components/ui/`
- Tailwind utilities in `src/utils/utils.ts`
- Styles in `public/content.css`

### 2. Configuration
- Demo data and settings in `public/config.js`
- Metadata and comments can be customized
- Trending articles can be updated

### 3. Styling
- Uses Tailwind CSS for styling
- CSS variables for theming in content.css
- Responsive design patterns
- Interactive states via Tailwind classes

### 4. Testing
- Test in Chrome after building
- Check overlay rendering
- Verify hover interactions
- Ensure responsive behavior
