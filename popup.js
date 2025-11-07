// Popup script for Tabnabbing Detector

document.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('clearBtn');
  
  // Clear highlights button
  clearBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { action: 'clearHighlights' });
        console.log('Highlights cleared');
      }
    } catch (error) {
      console.error('Error clearing highlights:', error);
    }
  });
});

