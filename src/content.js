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
  console.log('Loading images for comparison...');
  const beforeImg = await loadImage(beforeDataUrl);
  const afterImg = await loadImage(afterDataUrl);
  
  console.log('Before image size:', beforeImg.width, 'x', beforeImg.height);
  console.log('After image size:', afterImg.width, 'x', afterImg.height);
  
  const width = Math.min(beforeImg.width, afterImg.width);
  const height = Math.min(beforeImg.height, afterImg.height);
  
  // Store image dimensions for scaling
  window.screenshotWidth = width;
  window.screenshotHeight = height;
  
  const cols = Math.ceil(width / GRID_SIZE);
  const rows = Math.ceil(height / GRID_SIZE);
  
  console.log('Grid size:', cols, 'x', rows, 'squares');
  
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
          diff: comparison.misMatchPercentage,
          screenshotWidth: width,
          screenshotHeight: height
        });
      }
    }
  }
  
  console.log('Found', changedSquares.length, 'changed squares');
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
  console.log('Highlighting', changedSquares.length, 'changed squares');
  
  if (changedSquares.length === 0) {
    console.log('No changes to highlight');
    return;
  }
  
  createOverlay();
  
  // Get viewport dimensions for scaling
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Get screenshot dimensions (use first square's dimensions or stored values)
  const screenshotWidth = changedSquares[0].screenshotWidth || window.screenshotWidth || viewportWidth;
  const screenshotHeight = changedSquares[0].screenshotHeight || window.screenshotHeight || viewportHeight;
  
  console.log('Viewport:', viewportWidth, 'x', viewportHeight);
  console.log('Screenshot:', screenshotWidth, 'x', screenshotHeight);
  
  // Calculate scale factors
  const scaleX = viewportWidth / screenshotWidth;
  const scaleY = viewportHeight / screenshotHeight;
  
  console.log('Scale factors:', scaleX, 'x', scaleY);
  
  changedSquares.forEach((square, index) => {
    const highlight = document.createElement('div');
    
    // Scale coordinates from screenshot to viewport
    const scaledX = square.x * scaleX;
    const scaledY = square.y * scaleY;
    const scaledWidth = square.width * scaleX;
    const scaledHeight = square.height * scaleY;
    
    highlight.style.cssText = `
      position: fixed;
      left: ${scaledX}px;
      top: ${scaledY}px;
      width: ${scaledWidth}px;
      height: ${scaledHeight}px;
      background: rgba(255, 0, 0, 0.5);
      border: 3px solid rgba(255, 0, 0, 1);
      pointer-events: none;
      box-sizing: border-box;
      z-index: 999999;
    `;
    
    // Add a label for debugging
    highlight.setAttribute('data-index', index);
    highlight.setAttribute('data-diff', square.diff.toFixed(1) + '%');
    
    overlayDiv.appendChild(highlight);
    
    if (index < 5) { // Log first 5 for debugging
      console.log(`Highlight ${index}: x=${scaledX.toFixed(0)}, y=${scaledY.toFixed(0)}, w=${scaledWidth.toFixed(0)}, h=${scaledHeight.toFixed(0)}, diff=${square.diff.toFixed(1)}%`);
    }
  });
  
  console.log('Highlights added to page, total:', changedSquares.length);
  
  // Update badge color based on number of changes
  const changeCount = changedSquares.length;
  const severity = changeCount > 20 ? 'high' : changeCount > 10 ? 'medium' : 'low';
  
  console.log('Updating badge:', changeCount, 'changes, severity:', severity);
  
  chrome.runtime.sendMessage({
    action: 'updateBadge',
    severity: severity,
    count: changeCount
  }).then(() => {
    console.log('Badge update message sent');
  }).catch((error) => {
    console.error('Error sending badge update:', error);
  });
}

// Listen for comparison requests from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.action);
  
  if (message.action === 'compareScreenshots') {
    console.log('Starting screenshot comparison...');
    console.log('Before screenshot length:', message.before ? message.before.length : 'null');
    console.log('After screenshot length:', message.after ? message.after.length : 'null');
    
    // Check if Resemble.js is loaded
    if (typeof resemble === 'undefined') {
      console.error('Resemble.js is not loaded!');
      sendResponse({ success: false, error: 'Resemble.js not loaded' });
      return true;
    }
    
    compareGridSquares(message.before, message.after)
      .then((changedSquares) => {
        console.log('Comparison complete. Changed squares:', changedSquares.length);
        if (changedSquares.length > 0) {
          highlightChanges(changedSquares);
          comparisonResult = {
            changedSquares: changedSquares,
            timestamp: Date.now()
          };
        } else {
          console.log('No changes detected - showing test highlight for debugging');
          // Show a test highlight in top-left corner to verify overlay works
          createOverlay();
          const testHighlight = document.createElement('div');
          testHighlight.style.cssText = `
            position: fixed;
            left: 10px;
            top: 10px;
            width: 100px;
            height: 100px;
            background: rgba(0, 255, 0, 0.5);
            border: 3px solid rgba(0, 255, 0, 1);
            pointer-events: none;
            z-index: 999999;
          `;
          overlayDiv.appendChild(testHighlight);
          console.log('Test highlight added (green square in top-left)');
        }
        sendResponse({ success: true, changes: changedSquares.length });
      })
      .catch((error) => {
        console.error('Error comparing screenshots:', error);
        console.error('Error stack:', error.stack);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'clearHighlights') {
    removeOverlay();
    sendResponse({ success: true });
  }
  
  if (message.action === 'testHighlight') {
    // Test function to verify highlighting works
    createOverlay();
    const testHighlight = document.createElement('div');
    testHighlight.style.cssText = `
      position: fixed;
      left: 50px;
      top: 50px;
      width: 200px;
      height: 200px;
      background: rgba(255, 0, 0, 0.5);
      border: 5px solid rgba(255, 0, 0, 1);
      pointer-events: none;
      z-index: 999999;
    `;
    overlayDiv.appendChild(testHighlight);
    console.log('Test highlight added');
    sendResponse({ success: true });
  }
});

// Log when content script loads
console.log('Tabnabbing Detector content script loaded');
console.log('Resemble.js loaded:', typeof resemble !== 'undefined');
console.log('Window dimensions:', window.innerWidth, 'x', window.innerHeight);

// Expose test function to window for easy debugging
window.testTabnabbingHighlight = function() {
  console.log('Testing highlight overlay...');
  createOverlay();
  const testHighlight = document.createElement('div');
  testHighlight.style.cssText = `
    position: fixed;
    left: 50px;
    top: 50px;
    width: 200px;
    height: 200px;
    background: rgba(255, 0, 0, 0.5);
    border: 5px solid rgba(255, 0, 0, 1);
    pointer-events: none;
    z-index: 999999;
  `;
  if (overlayDiv) {
    overlayDiv.appendChild(testHighlight);
    console.log('✓ Test highlight added (red square at 50,50)');
    return true;
  } else {
    console.error('✗ Overlay not created');
    return false;
  }
};

console.log('💡 Tip: Run testTabnabbingHighlight() in console to test highlight overlay');

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  removeOverlay();
});

