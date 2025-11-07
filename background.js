// Background Service Worker for Tabnabbing Detection
// Captures screenshots and monitors tab focus changes

const SCREENSHOT_INTERVAL = 3000; // 3 seconds between screenshots
const COMPARISON_DELAY = 1000; // Wait 1 second before comparing after refocus

// Storage for screenshots and focus state
const tabData = new Map(); // tabId -> { screenshot, timestamp, hasFocus }

/**
 * Capture a screenshot of the specified tab
 */
async function captureScreenshot(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    
    // Skip protected pages
    if (!tab.url || isProtectedUrl(tab.url)) {
      return null;
    }
    
    // Only capture if tab is active
    if (!tab.active) {
      return null;
    }
    
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png'
    });
    
    console.log(`[Tab ${tabId}] Screenshot captured`);
    return dataUrl;
    
  } catch (error) {
    // Silently ignore common errors
    if (!isExpectedError(error)) {
      console.error(`[Tab ${tabId}] Screenshot error:`, error.message);
    }
    return null;
  }
}

/**
 * Check if URL is protected (cannot be captured)
 */
function isProtectedUrl(url) {
  const protectedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'edge://',
    'devtools://'
  ];
  return protectedPrefixes.some(prefix => url.startsWith(prefix));
}

/**
 * Check if error is expected and can be ignored
 */
function isExpectedError(error) {
  const expectedErrors = [
    'Cannot access',
    'not in effect',
    'being dragged',
    'cannot be edited'
  ];
  return error.message && expectedErrors.some(msg => 
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

/**
 * Monitor active tab and take periodic screenshots
 */
async function monitorActiveTab(tabId) {
  const data = tabData.get(tabId) || { hasFocus: true };
  
  if (data.hasFocus) {
    const screenshot = await captureScreenshot(tabId);
    if (screenshot) {
      data.screenshot = screenshot;
      data.timestamp = Date.now();
      tabData.set(tabId, data);
    }
  }
}

/**
 * Handle tab activation (user switches to a tab)
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tabId = activeInfo.tabId;
  const data = tabData.get(tabId) || {};
  
  console.log(`[Tab ${tabId}] Activated`);
  
  // If tab was previously unfocused, compare screenshots
  if (data.hasFocus === false && data.screenshot) {
    console.log(`[Tab ${tabId}] Was unfocused, will compare after delay`);
    
    // Wait for page to settle, then compare
    setTimeout(async () => {
      const newScreenshot = await captureScreenshot(tabId);
      
      if (newScreenshot && data.screenshot) {
        console.log(`[Tab ${tabId}] Sending comparison request to content script`);
        
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'compare',
            before: data.screenshot,
            after: newScreenshot
          });
          
          // Update stored screenshot
          data.screenshot = newScreenshot;
          data.timestamp = Date.now();
          
        } catch (error) {
          if (!error.message?.includes('Could not establish connection')) {
            console.error(`[Tab ${tabId}] Message error:`, error.message);
          }
        }
      }
    }, COMPARISON_DELAY);
  }
  
  // Mark all other tabs as unfocused
  for (const [id, d] of tabData.entries()) {
    d.hasFocus = (id === tabId);
  }
  
  // Mark current tab as focused
  data.hasFocus = true;
  tabData.set(tabId, data);
  
  // Start monitoring this tab
  monitorActiveTab(tabId);
  
  // Set up periodic screenshots
  if (data.intervalId) {
    clearInterval(data.intervalId);
  }
  data.intervalId = setInterval(() => monitorActiveTab(tabId), SCREENSHOT_INTERVAL);
  tabData.set(tabId, data);
});

/**
 * Handle window focus changes
 */
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // All windows lost focus
    for (const data of tabData.values()) {
      data.hasFocus = false;
    }
  } else {
    // Window gained focus, update active tab
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs[0]) {
        const data = tabData.get(tabs[0].id) || {};
        data.hasFocus = true;
        tabData.set(tabs[0].id, data);
      }
    });
  }
});

/**
 * Clean up when tab is closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  const data = tabData.get(tabId);
  if (data?.intervalId) {
    clearInterval(data.intervalId);
  }
  tabData.delete(tabId);
  console.log(`[Tab ${tabId}] Cleaned up`);
});

/**
 * Handle badge updates from content script
 */
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'updateBadge' && sender.tab) {
    const { changeCount, severity } = message;
    const tabId = sender.tab.id;
    
    // Set badge color based on severity
    const colors = {
      high: '#DC3545',    // Red
      medium: '#FF8C00',  // Orange
      low: '#FFC107'      // Yellow
    };
    
    chrome.action.setBadgeText({ 
      text: changeCount.toString(),
      tabId 
    });
    
    chrome.action.setBadgeBackgroundColor({ 
      color: colors[severity] || colors.high,
      tabId 
    });
    
    console.log(`[Tab ${tabId}] Badge updated: ${changeCount} changes (${severity})`);
  }
});

/**
 * Initialize extension on startup
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Tabnabbing Detector installed');
  
  // Start monitoring active tabs
  chrome.tabs.query({ active: true }, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        const data = { hasFocus: true };
        tabData.set(tab.id, data);
        monitorActiveTab(tab.id);
        data.intervalId = setInterval(() => monitorActiveTab(tab.id), SCREENSHOT_INTERVAL);
        tabData.set(tab.id, data);
      }
    });
  });
});

console.log('Tabnabbing Detector background script loaded');

