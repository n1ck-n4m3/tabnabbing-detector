// Background service worker for Tabnabbing Detector
// Takes screenshots and detects tab focus changes

const SCREENSHOT_INTERVAL = 2000; // 2 seconds
const tabScreenshots = new Map(); // tabId -> {screenshot, timestamp}
const tabFocusState = new Map(); // tabId -> {hasFocus, lastFocusTime}

// Take screenshot of a tab
async function takeScreenshot(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return null;
    }
    
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 100
    });
    console.log('Screenshot captured for tab', tabId);
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
  
  console.log('Tab activated:', tabId, 'Previous state:', currentState);
  
  // If tab was previously unfocused, check for changes
  if (currentState && !currentState.hasFocus) {
    const previousScreenshot = tabScreenshots.get(tabId);
    if (previousScreenshot) {
      console.log('Tab was unfocused, checking for changes...');
      // Small delay to ensure page is fully loaded
      setTimeout(async () => {
        // Take new screenshot
        const newScreenshot = await takeScreenshot(tabId);
        if (newScreenshot && previousScreenshot.screenshot) {
          console.log('Screenshots ready, sending to content script for comparison');
          // Notify content script to compare
          chrome.tabs.sendMessage(tabId, {
            action: 'compareScreenshots',
            before: previousScreenshot.screenshot,
            after: newScreenshot
          }).then(() => {
            console.log('Message sent to content script');
          }).catch((error) => {
            console.error('Error sending message to content script:', error);
          });
        }
      }, 1000); // Increased delay to 1 second
    }
  }
  
  // Mark other tabs as unfocused
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id !== tabId && tab.active) {
        tabFocusState.set(tab.id, {
          hasFocus: false,
          lastFocusTime: Date.now()
        });
      }
    });
  });
  
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

// Handle badge updates from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge') {
    const colors = {
      high: '#ff0000',
      medium: '#ff8800',
      low: '#ffaa00'
    };
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      chrome.action.setBadgeText({ 
        text: message.count.toString(),
        tabId: tabId
      });
      chrome.action.setBadgeBackgroundColor({ 
        color: colors[message.severity] || '#ff0000',
        tabId: tabId
      });
      console.log('Badge updated:', message.count, 'changes, severity:', message.severity);
    }
    sendResponse({ success: true });
  }
});

// Initialize on extension startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Tabnabbing Detector installed');
});

// Initialize active tabs on startup
chrome.tabs.query({ active: true }, (tabs) => {
  tabs.forEach(tab => {
    if (tab.id) {
      tabFocusState.set(tab.id, {
        hasFocus: true,
        lastFocusTime: Date.now()
      });
      monitorTab(tab.id);
      const intervalId = setInterval(() => {
        monitorTab(tab.id);
      }, SCREENSHOT_INTERVAL);
      if (!tabIntervals) tabIntervals = new Map();
      tabIntervals.set(tab.id, intervalId);
    }
  });
});


