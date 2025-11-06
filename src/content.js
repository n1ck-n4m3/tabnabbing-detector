// Content script for highlighting changes on the page
// Uses Resemble.js to compare screenshots and highlight differences

const GRID_SIZE = 50; // Size of each square in pixels
let overlayDiv = null;
let comparisonResult = null;

// Create overlay for highlighting changes
function createOverlay() {
  if (overlayDiv) {
    overlayDiv.remove();
  }
  
  overlayDiv = document.createElement('div');
  overlayDiv.id = 'tabnabbing-overlay';
  overlayDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999999;
  `;
  document.body.appendChild(overlayDiv);
}

// Remove overlay
function removeOverlay() {
  if (overlayDiv) {
    overlayDiv.remove();
    overlayDiv = null;
  }
}

// Compare screenshots using Resemble.js
function compareScreenshots(beforeDataUrl, afterDataUrl) {
  return new Promise((resolve) => {
    if (typeof resemble === 'undefined') {
      console.error('Resemble.js not loaded');
      resolve({ misMatchPercentage: 0 });
      return;
    }
    
    try {
      resemble(beforeDataUrl)
        .compareTo(afterDataUrl)
        .ignoreColors()
        .onComplete((data) => {
          resolve(data);
        });
    } catch (error) {
      console.error('Error in Resemble.js comparison:', error);
      resolve({ misMatchPercentage: 0 });
    }
  });
}

// Split image into grid and compare each square
async function compareGridSquares(beforeDataUrl, afterDataUrl) {
  const beforeImg = await loadImage(beforeDataUrl);
  const afterImg = await loadImage(afterDataUrl);
  
  const width = Math.min(beforeImg.width, afterImg.width);
  const height = Math.min(beforeImg.height, afterImg.height);
  
  const cols = Math.ceil(width / GRID_SIZE);
  const rows = Math.ceil(height / GRID_SIZE);
  
  const changedSquares = [];
  
  // Compare each square
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * GRID_SIZE;
      const y = row * GRID_SIZE;
      const squareWidth = Math.min(GRID_SIZE, width - x);
      const squareHeight = Math.min(GRID_SIZE, height - y);
      
      // Extract square from both images
      const beforeSquare = extractSquare(beforeImg, x, y, squareWidth, squareHeight);
      const afterSquare = extractSquare(afterImg, x, y, squareWidth, squareHeight);
      
      // Compare squares
      const comparison = await compareScreenshots(beforeSquare, afterSquare);
      
      if (comparison && comparison.misMatchPercentage > 5) { // Threshold: 5% difference
        changedSquares.push({
          x: x,
          y: y,
          width: squareWidth,
          height: squareHeight,
          diff: comparison.misMatchPercentage
        });
      }
    }
  }
  
  return changedSquares;
}

// Load image from data URL
function loadImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = dataUrl;
  });
}

// Extract square from image
function extractSquare(img, x, y, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // Draw the portion of the image to the canvas
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

// Highlight changed squares on the page
function highlightChanges(changedSquares) {
  createOverlay();
  
  changedSquares.forEach((square) => {
    const highlight = document.createElement('div');
    highlight.style.cssText = `
      position: absolute;
      left: ${square.x}px;
      top: ${square.y}px;
      width: ${square.width}px;
      height: ${square.height}px;
      background: rgba(255, 0, 0, 0.3);
      border: 2px solid rgba(255, 0, 0, 0.8);
      pointer-events: none;
      box-sizing: border-box;
    `;
    overlayDiv.appendChild(highlight);
  });
  
  // Update badge color based on number of changes
  const changeCount = changedSquares.length;
  const severity = changeCount > 20 ? 'high' : changeCount > 10 ? 'medium' : 'low';
  
  chrome.runtime.sendMessage({
    action: 'updateBadge',
    severity: severity,
    count: changeCount
  });
}

// Listen for comparison requests from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'compareScreenshots') {
    compareGridSquares(message.before, message.after)
      .then((changedSquares) => {
        if (changedSquares.length > 0) {
          highlightChanges(changedSquares);
          comparisonResult = {
            changedSquares: changedSquares,
            timestamp: Date.now()
          };
        }
        sendResponse({ success: true, changes: changedSquares.length });
      })
      .catch((error) => {
        console.error('Error comparing screenshots:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'clearHighlights') {
    removeOverlay();
    sendResponse({ success: true });
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  removeOverlay();
});

