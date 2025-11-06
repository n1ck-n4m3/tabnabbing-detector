// Background service worker for Tabnabbing Detector
// Takes screenshots and detects tab focus changes

const SCREENSHOT_INTERVAL = 2000; // 2 seconds
const tabScreenshots = new Map(); // tabId -> {screenshot, timestamp}
const tabFocusState = new Map(); // tabId -> {hasFocus, lastFocusTime}

// Take screenshot of a tab
async function takeScreenshot(tabId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });
    return dataUrl;
  } catch (error) {
    console.error('Error taking screenshot:', error);
    return null;
  }
}

// Note: Service workers don't have DOM access
// Image processing will be done in content script

// Monitor tabs and take periodic screenshots
async function monitorTab(tabId) {
  if (!tabId) return;
  
  const screenshot = await takeScreenshot(tabId);
  if (screenshot) {
    tabScreenshots.set(tabId, {
      screenshot: screenshot,
      timestamp: Date.now()
    });
  }
}

// Check for tab focus changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tabId = activeInfo.tabId;
  const currentState = tabFocusState.get(tabId);
  
  // If tab was previously unfocused, check for changes
  if (currentState && !currentState.hasFocus) {
    const previousScreenshot = tabScreenshots.get(tabId);
    if (previousScreenshot) {
      // Small delay to ensure page is fully loaded
      setTimeout(async () => {
        // Take new screenshot
        const newScreenshot = await takeScreenshot(tabId);
        if (newScreenshot && previousScreenshot.screenshot) {
          // Notify content script to compare
          chrome.tabs.sendMessage(tabId, {
            action: 'compareScreenshots',
            before: previousScreenshot.screenshot,
            after: newScreenshot
          }).catch(() => {
            // Content script might not be ready, ignore
          });
        }
      }, 500);
    }
  }
  
  // Update focus state
  tabFocusState.set(tabId, {
    hasFocus: true,
    lastFocusTime: Date.now()
  });
  
  // Clear existing interval for this tab
  if (tabIntervals && tabIntervals.has(tabId)) {
    clearInterval(tabIntervals.get(tabId));
  }
  
  // Start monitoring this tab
  monitorTab(tabId);
  const intervalId = setInterval(() => {
    monitorTab(tabId);
  }, SCREENSHOT_INTERVAL);
  
  // Store interval ID to clear later
  if (!tabIntervals) tabIntervals = new Map();
  tabIntervals.set(tabId, intervalId);
});

// Detect when tab loses focus
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    tabFocusState.set(tabId, {
      hasFocus: true,
      lastFocusTime: Date.now()
    });
  }
});

// Window focus events
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // All windows lost focus - mark all tabs as unfocused
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.active) {
          tabFocusState.set(tab.id, {
            hasFocus: false,
            lastFocusTime: Date.now()
          });
        }
      });
    });
  } else {
    // Window gained focus - update active tab
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs[0]) {
        const tabId = tabs[0].id;
        tabFocusState.set(tabId, {
          hasFocus: true,
          lastFocusTime: Date.now()
        });
      }
    });
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabScreenshots.delete(tabId);
  tabFocusState.delete(tabId);
  if (tabIntervals) {
    clearInterval(tabIntervals.get(tabId));
    tabIntervals.delete(tabId);
  }
  chrome.storage.local.remove([
    `screenshot_${tabId}_before`,
    `screenshot_${tabId}_after`,
    `tab_${tabId}_needs_comparison`
  ]);
});

let tabIntervals = new Map();

// Initialize on extension startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Tabnabbing Detector installed');
});

