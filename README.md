# Tabnabbing Detector Chrome Extension

A Chrome extension (Manifest V3) that detects tabnabbing attacks by comparing screenshots before and after tab focus loss.

## Features

- **Automatic Screenshot Monitoring**: Takes screenshots of active tabs at regular intervals (2 seconds)
- **Focus Loss Detection**: Detects when a tab loses focus
- **Change Detection**: Compares screenshots when user returns to a tab
- **Visual Highlighting**: Highlights changed areas on the page using a grid-based approach
- **Badge Alerts**: Shows color-coded badge in the extension icon based on severity

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `tabnabbing-detector` directory

## How It Works

1. **Screenshot Capture**: While browsing, the extension takes screenshots every 2 seconds of the active tab
2. **Focus Detection**: When a tab loses focus (user switches tabs), the last screenshot is saved
3. **Comparison**: When the user returns to the tab, a new screenshot is taken and compared with the previous one
4. **Change Highlighting**: The page is divided into a grid (50x50px squares), and each square is compared. Changed squares are highlighted in red
5. **Alert System**: The extension badge shows the number of changed squares with color coding:
   - Red: High severity (>20 changes)
   - Orange: Medium severity (10-20 changes)
   - Yellow: Low severity (<10 changes)

## Technical Details

- **Manifest Version**: 3
- **Comparison Library**: Resemble.js (for image comparison)
- **Grid Size**: 50x50 pixels per square
- **Change Threshold**: 5% difference per square
- **Permissions**: 
  - `tabs`: To access tab information and monitor tab changes
  - `activeTab`: To capture screenshots of the active tab
  - `storage`: To temporarily store screenshots for comparison
  - `host_permissions` (`<all_urls>`): Required for automatic screenshot capture without user interaction (necessary for tabnabbing detection)

## Project Structure

```
tabnabbing-detector/
├── manifest.json          # Extension manifest
├── src/
│   ├── background.js     # Service worker for screenshot capture
│   ├── content.js        # Content script for change highlighting
│   ├── popup.html        # Extension popup UI
│   └── popup.js          # Popup script
├── lib/
│   └── resemble.js       # Resemble.js library for image comparison
└── icons/                # Extension icons
```

## Usage

1. Install the extension
2. Browse normally - the extension works automatically
3. If a tabnabbing attack is detected (page changes after losing focus), changed areas will be highlighted in red
4. Click the extension icon to see status and clear highlights

## Limitations

- Screenshots are taken every 2 seconds, so very rapid changes might be missed
- The grid-based approach provides approximate change detection
- Performance may be affected on pages with heavy content

## Development

This extension uses:
- Chrome Extension Manifest V3
- Resemble.js for image comparison
- Minimal permissions for security

## License

Educational project for Web Security course.

