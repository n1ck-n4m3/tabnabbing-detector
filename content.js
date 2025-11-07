// Content Script for Tabnabbing Detection
// Compares screenshots and highlights changes using grid-based approach

const GRID_SIZE = 40; // Size of each square in pixels
const CHANGE_THRESHOLD = 5; // Percentage difference to consider as changed

let overlay = null;

/**
 * Compare two screenshots using grid-based approach with Resemble.js
 */
async function compareScreenshots(beforeDataUrl, afterDataUrl) {
  console.log('Starting screenshot comparison...');
  
  // Load images
  const beforeImg = await loadImage(beforeDataUrl);
  const afterImg = await loadImage(afterDataUrl);
  
  const width = Math.min(beforeImg.width, afterImg.width);
  const height = Math.min(beforeImg.height, afterImg.height);
  
  console.log(`Image size: ${width}x${height}`);
  
  // Calculate grid dimensions
  const cols = Math.ceil(width / GRID_SIZE);
  const rows = Math.ceil(height / GRID_SIZE);
  
  console.log(`Grid: ${cols}x${rows} squares`);
  
  const changedSquares = [];
  
  // Compare each grid square
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * GRID_SIZE;
      const y = row * GRID_SIZE;
      const w = Math.min(GRID_SIZE, width - x);
      const h = Math.min(GRID_SIZE, height - y);
      
      // Extract and compare square
      const beforeSquare = extractSquare(beforeImg, x, y, w, h);
      const afterSquare = extractSquare(afterImg, x, y, w, h);
      
      const diff = await compareSquares(beforeSquare, afterSquare);
      
      if (diff > CHANGE_THRESHOLD) {
        changedSquares.push({ x, y, w, h, diff });
      }
    }
  }
  
  console.log(`Found ${changedSquares.length} changed squares`);
  
  return {
    changedSquares,
    imageWidth: width,
    imageHeight: height
  };
}

/**
 * Load image from data URL
 */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Extract a square region from an image
 */
function extractSquare(img, x, y, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

/**
 * Compare two image squares using Resemble.js
 */
function compareSquares(img1, img2) {
  return new Promise((resolve) => {
    if (typeof resemble === 'undefined') {
      console.error('Resemble.js not loaded!');
      resolve(0);
      return;
    }
    
    resemble(img1)
      .compareTo(img2)
      .ignoreAntialiasing()
      .onComplete((data) => {
        resolve(parseFloat(data.misMatchPercentage));
      });
  });
}

/**
 * Highlight changed areas on the page
 */
function highlightChanges(result) {
  const { changedSquares, imageWidth, imageHeight } = result;
  
  if (changedSquares.length === 0) {
    console.log('No changes detected');
    return;
  }
  
  // Remove old overlay
  removeOverlay();
  
  // Create new overlay
  overlay = document.createElement('div');
  overlay.id = 'tabnabbing-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2147483647;
  `;
  
  // Calculate scale factors
  const scaleX = window.innerWidth / imageWidth;
  const scaleY = window.innerHeight / imageHeight;
  
  console.log(`Scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
  
  // Create highlights for each changed square
  changedSquares.forEach((square, index) => {
    const highlight = document.createElement('div');
    
    const scaledX = square.x * scaleX;
    const scaledY = square.y * scaleY;
    const scaledW = square.w * scaleX;
    const scaledH = square.h * scaleY;
    
    // Color based on change severity
    let color;
    if (square.diff > 50) {
      color = '220, 53, 69'; // Red - major change
    } else if (square.diff > 20) {
      color = '255, 140, 0'; // Orange - moderate change
    } else {
      color = '255, 193, 7'; // Yellow - minor change
    }
    
    highlight.style.cssText = `
      position: fixed;
      left: ${scaledX}px;
      top: ${scaledY}px;
      width: ${scaledW}px;
      height: ${scaledH}px;
      background: rgba(${color}, 0.4);
      border: 2px solid rgba(${color}, 0.8);
      box-sizing: border-box;
      pointer-events: none;
      z-index: 2147483647;
      animation: pulse 2s ease-in-out infinite;
    `;
    
    overlay.appendChild(highlight);
    
    if (index < 3) {
      console.log(`Highlight ${index}: (${scaledX.toFixed(0)}, ${scaledY.toFixed(0)}) ${scaledW.toFixed(0)}x${scaledH.toFixed(0)} - ${square.diff.toFixed(1)}%`);
    }
  });
  
  // Add pulse animation
  if (!document.getElementById('tabnabbing-style')) {
    const style = document.createElement('style');
    style.id = 'tabnabbing-style';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(overlay);
  console.log(`Highlighted ${changedSquares.length} changes`);
  
  // Update badge
  const severity = changedSquares.length > 15 ? 'high' : 
                   changedSquares.length > 5 ? 'medium' : 'low';
  
  chrome.runtime.sendMessage({
    action: 'updateBadge',
    changeCount: changedSquares.length,
    severity
  }).catch(err => console.error('Badge update error:', err));
}

/**
 * Remove highlight overlay
 */
function removeOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'compare') {
    console.log('Comparison request received');
    
    if (typeof resemble === 'undefined') {
      console.error('Resemble.js not available');
      sendResponse({ success: false, error: 'Resemble.js not loaded' });
      return;
    }
    
    compareScreenshots(message.before, message.after)
      .then(result => {
        highlightChanges(result);
        sendResponse({ success: true, changes: result.changedSquares.length });
      })
      .catch(error => {
        console.error('Comparison error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'clearHighlights') {
    removeOverlay();
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  removeOverlay();
});

console.log('Tabnabbing Detector content script loaded');
console.log('Resemble.js available:', typeof resemble !== 'undefined');

