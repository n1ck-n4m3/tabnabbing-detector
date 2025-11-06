// Popup script for extension UI

document.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('clearBtn');
  
  clearBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'clearHighlights' });
    }
  });
  
  // Update badge color
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateBadge') {
      const colors = {
        high: '#ff0000',
        medium: '#ff8800',
        low: '#ffaa00'
      };
      chrome.action.setBadgeText({ text: message.count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: colors[message.severity] || '#ff0000' });
    }
  });
});

