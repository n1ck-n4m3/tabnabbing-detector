# Tabnabbing Detector

A Chrome extension that detects and highlights tabnabbing attacks by comparing page screenshots using a grid-based approach.

## Overview

Tabnabbing is a phishing attack where malicious websites change their appearance when the tab loses focus, often mimicking login pages of legitimate sites (like PayPal or Gmail) to steal credentials. This extension detects such attacks by:

1. Taking periodic screenshots of active tabs
2. Detecting when tabs lose focus
3. Comparing screenshots when the user returns to a tab
4. Highlighting suspicious changes on the page

## Features

- **Automatic Screenshot Monitoring**: Captures screenshots every 3 seconds
- **Grid-Based Comparison**: Divides pages into 40×40px squares for efficient comparison
- **Visual Highlighting**: Color-coded overlays show changed areas:
  - 🔴 Red: Major changes (>50% difference)
  - 🟠 Orange: Moderate changes (20-50% difference)
  - 🟡 Yellow: Minor changes (5-20% difference)
- **Badge Alerts**: Extension icon shows the number of detected changes
- **Minimal Permissions**: Only requires `tabs` and `<all_urls>` permissions

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `tabnabbing-detector` directory

## Testing

1. Open the test page: `test-paypal.html`
2. Wait 3-5 seconds for initial screenshots
3. Switch to another tab or window
4. Wait 2-3 seconds (page will transform to phishing version)
5. Switch back to the PayPal tab
6. **Result**: Changed areas should be highlighted with colored overlays

## Technical Details

### Architecture

- **manifest.json**: Manifest V3 configuration with minimal permissions
- **background.js**: Service worker that handles screenshot capture and focus detection
- **content.js**: Content script that performs grid-based comparison and highlights changes
- **lib/resemble.js**: Image comparison library for pixel-level analysis

### Comparison Algorithm

1. **Screenshot Capture**: Uses `chrome.tabs.captureVisibleTab()` API
2. **Grid Division**: Divides images into 40×40px squares
3. **Per-Square Comparison**: Uses Resemble.js to compare each square
4. **Threshold Detection**: Marks squares with >5% difference as changed
5. **Coordinate Scaling**: Scales highlight coordinates from screenshot to viewport
6. **Visual Overlay**: Creates fixed-position divs to highlight changes

### Permissions

- **`tabs`**: Required to capture screenshots and monitor tab state
- **`<all_urls>`**: Required for content script injection on all pages

No storage, scripting, or other unnecessary permissions are requested.

## How to Use

1. **Install the extension** (see Installation section)
2. **Browse normally** - the extension works automatically
3. **If an attack is detected**:
   - Changed areas will be highlighted on the page
   - Extension badge will show the number of changes
   - Click the extension icon to see details
   - Click "Clear Highlights" to remove overlays

## Project Structure

```
tabnabbing-detector/
├── manifest.json          # Extension configuration
├── background.js          # Screenshot capture and focus detection
├── content.js             # Grid comparison and highlighting
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── lib/
│   └── resemble.js        # Image comparison library
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── test-paypal.html       # Test page simulating tabnabbing attack
└── README.md              # This file
```

## Design Decisions

### Grid-Based Approach

- **Why**: Efficient comparison of large screenshots
- **Grid Size**: 40×40px balances accuracy and performance
- **Threshold**: 5% difference minimizes false positives

### Screenshot Interval

- **Frequency**: 3 seconds between screenshots
- **Why**: Balance between detection speed and performance impact

### Local Comparison

- **Library**: Resemble.js for pixel-level comparison
- **Privacy**: All comparisons done locally in JavaScript
- **No External Services**: No data sent to external servers

## Limitations

- Screenshots are taken every 3 seconds, so very rapid changes might be missed
- Grid-based approach provides approximate change detection
- Cannot capture screenshots of protected pages (chrome://, etc.)
- Performance may be affected on pages with heavy content

## References

- Based on requirements from Web Security course project
- Uses Resemble.js for image comparison: https://github.com/rsmbl/Resemble.js
- Implements grid-based comparison as suggested in the project description

## License

See LICENSE file for details.

## Notes

This is an educational project for demonstrating tabnabbing detection. The implementation focuses on:

1. **Minimal permissions** - only essential permissions requested
2. **Local processing** - all comparisons done via JavaScript locally
3. **Visual feedback** - clear highlighting of suspicious changes
4. **Grid-based detection** - efficient comparison approach

