// Content Script for Tabnabbing Detection
// Compares screenshots and highlights changes using grid-based approach

const GRID_SIZE = 30; // Size of each square in pixels (smaller for more precision)

// Dynamic threshold settings - optimized to filter browser rendering noise
const HIGH_DIFF_THRESHOLD = 50; // High difference - definitely malicious change (raised from 40%)
const MEDIUM_DIFF_THRESHOLD = 35; // Medium difference - check if adjacent to high diff (raised from 20%)
const LOW_DIFF_THRESHOLD = 15; // Low difference - likely browser rendering noise, ignore
const MIN_DIFF_FOR_MERGE = 35; // Minimum difference percentage to include in merged regions

let overlay = null;
let highlightData = null; // Store highlight data for scroll updates
let screenshotScrollY = 0; // Store scroll position when screenshot was taken

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
  
  // Batch compare squares for better performance
  const comparisons = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * GRID_SIZE;
      const y = row * GRID_SIZE;
      const w = Math.min(GRID_SIZE, width - x);
      const h = Math.min(GRID_SIZE, height - y);
      
      // Extract squares
      const beforeSquare = extractSquare(beforeImg, x, y, w, h);
      const afterSquare = extractSquare(afterImg, x, y, w, h);
      
      // Store comparison promise
      comparisons.push(
        compareSquares(beforeSquare, afterSquare).then(diff => ({
          x, y, w, h, diff
        }))
      );
    }
  }
  
  // Wait for all comparisons in batches to avoid blocking
  const batchSize = 20; // Process 20 comparisons at a time
  for (let i = 0; i < comparisons.length; i += batchSize) {
    const batch = comparisons.slice(i, i + batchSize);
    const results = await Promise.all(batch);
    
    // Dynamic threshold filtering - stricter to reduce false positives:
    // - High diff (>=50%): Definitely malicious change, always include
    // - Medium diff (35-50%): Only keep if adjacent to high diff regions
    // - Low diff (<35%): Likely browser rendering noise, ignore completely
    results.forEach(result => {
      if (result.diff >= HIGH_DIFF_THRESHOLD) {
        // High difference - definitely malicious change
        changedSquares.push(result);
      } else if (result.diff >= MEDIUM_DIFF_THRESHOLD) {
        // Medium difference - potential malicious change, keep for adjacency check
        changedSquares.push(result);
      }
      // Low difference (< MEDIUM_DIFF_THRESHOLD) - ignore browser rendering noise
    });
  }
  
  console.log(`Found ${changedSquares.length} changed squares before merging`);
  
  // Separate high and medium difference squares
  const highDiffSquares = changedSquares.filter(s => s.diff >= HIGH_DIFF_THRESHOLD);
  const mediumDiffSquares = changedSquares.filter(s => s.diff >= MEDIUM_DIFF_THRESHOLD && s.diff < HIGH_DIFF_THRESHOLD);
  
  console.log(`High diff squares (>=${HIGH_DIFF_THRESHOLD}%): ${highDiffSquares.length}`);
  console.log(`Medium diff squares (${MEDIUM_DIFF_THRESHOLD}-${HIGH_DIFF_THRESHOLD}%): ${mediumDiffSquares.length}`);
  
  // Stricter filtering: only keep medium diff squares if:
  // 1. There are high diff squares AND
  // 2. They are directly adjacent (not just close)
  const filteredMediumDiff = filterMediumDiffSquares(mediumDiffSquares, highDiffSquares);
  
  // Additional filter: if no high diff squares at all, ignore all medium diff
  // This prevents false positives from browser rendering noise
  const significantChanges = highDiffSquares.length > 0 
    ? [...highDiffSquares, ...filteredMediumDiff]
    : []; // If no high diff, ignore everything (likely all noise)
  
  console.log(`After filtering: ${significantChanges.length} significant changes`);
  
  // Merge adjacent changed squares to create larger regions
  const mergedRegions = mergeAdjacentSquares(significantChanges, width, height);
  
  console.log(`Merged to ${mergedRegions.length} regions`);
  
  return {
    changedSquares: mergedRegions,
    imageWidth: width,
    imageHeight: height
  };
}

/**
 * Filter medium difference squares - only keep those adjacent to high difference squares
 * This filters out browser rendering noise while preserving actual malicious changes
 */
function filterMediumDiffSquares(mediumDiffSquares, highDiffSquares) {
  if (mediumDiffSquares.length === 0 || highDiffSquares.length === 0) {
    // If no high diff squares, filter out all medium diff (likely noise)
    return [];
  }
  
  // Stricter adjacency tolerance - only merge directly adjacent squares
  const adjacencyTolerance = GRID_SIZE * 0.8; // Reduced from 1.5 to 0.8 (24px instead of 45px)
  const filtered = [];
  
  for (const mediumSquare of mediumDiffSquares) {
    let isAdjacentToHighDiff = false;
    
    // Check if this medium diff square is directly adjacent to any high diff square
    for (const highSquare of highDiffSquares) {
      // Calculate center points
      const mediumCenterX = mediumSquare.x + mediumSquare.w / 2;
      const mediumCenterY = mediumSquare.y + mediumSquare.h / 2;
      const highCenterX = highSquare.x + highSquare.w / 2;
      const highCenterY = highSquare.y + highSquare.h / 2;
      
      // Calculate distance between centers
      const distanceX = Math.abs(mediumCenterX - highCenterX);
      const distanceY = Math.abs(mediumCenterY - highCenterY);
      
      // Check if squares are directly adjacent (touching or very close)
      const maxAllowedDistance = Math.max(
        mediumSquare.w / 2 + highSquare.w / 2,
        mediumSquare.h / 2 + highSquare.h / 2
      ) + adjacencyTolerance;
      
      if (distanceX <= maxAllowedDistance && distanceY <= maxAllowedDistance) {
        isAdjacentToHighDiff = true;
        break;
      }
    }
    
    // Only keep medium diff squares that are directly adjacent to high diff squares
    if (isAdjacentToHighDiff) {
      filtered.push(mediumSquare);
    }
  }
  
  return filtered;
}

/**
 * Merge adjacent changed squares into larger regions using efficient algorithm
 * Prevents nested/overlapping regions
 */
function mergeAdjacentSquares(squares, imageWidth, imageHeight) {
  if (squares.length === 0) return [];
  
  // Use a more efficient merging approach
  // Group squares by proximity and merge them
  const regions = [];
  const processed = new Set();
  
  // Reduced tolerance for merging - only merge directly adjacent squares
  // This prevents over-merging and keeps highlights more precise
  const mergeTolerance = GRID_SIZE * 0.15; // Further reduced from 0.2 to 0.15 (4.5px instead of 6px)
  
  for (let i = 0; i < squares.length; i++) {
    if (processed.has(i)) continue;
    
    const square = squares[i];
    let region = {
      x: square.x,
      y: square.y,
      w: square.w,
      h: square.h,
      maxDiff: square.diff
    };
    
    processed.add(i);
    
    // Find and merge all adjacent squares in one pass
    let foundMore = true;
    while (foundMore) {
      foundMore = false;
      for (let j = 0; j < squares.length; j++) {
        if (processed.has(j)) continue;
        
        const other = squares[j];
        
        // Only merge if squares are directly adjacent (not just close)
        // This keeps highlights more precise and prevents over-merging
        const isDirectlyAdjacent = (
          // Right adjacent (touching or very close)
          (other.x >= region.x + region.w && 
           other.x <= region.x + region.w + mergeTolerance &&
           other.y < region.y + region.h && 
           other.y + other.h > region.y) ||
          // Left adjacent
          (other.x + other.w >= region.x - mergeTolerance && 
           other.x + other.w <= region.x &&
           other.y < region.y + region.h && 
           other.y + other.h > region.y) ||
          // Bottom adjacent
          (other.y >= region.y + region.h && 
           other.y <= region.y + region.h + mergeTolerance &&
           other.x < region.x + region.w && 
           other.x + other.w > region.x) ||
          // Top adjacent
          (other.y + other.h >= region.y - mergeTolerance && 
           other.y + other.h <= region.y &&
           other.x < region.x + region.w && 
           other.x + other.w > region.x) ||
          // Overlapping
          (other.x < region.x + region.w && 
           other.x + other.w > region.x &&
           other.y < region.y + region.h && 
           other.y + other.h > region.y)
        );
        
        // Only merge if the other square has significant difference
        // Since we've already filtered, all squares here are significant (>= MEDIUM_DIFF_THRESHOLD)
        if (isDirectlyAdjacent && other.diff >= MEDIUM_DIFF_THRESHOLD) {
          // Merge into region
          const newX = Math.min(region.x, other.x);
          const newY = Math.min(region.y, other.y);
          const newW = Math.max(region.x + region.w, other.x + other.w) - newX;
          const newH = Math.max(region.y + region.h, other.y + other.h) - newY;
          
          region = {
            x: newX,
            y: newY,
            w: newW,
            h: newH,
            maxDiff: Math.max(region.maxDiff, other.diff)
          };
          
          processed.add(j);
          foundMore = true;
        }
      }
    }
    
    regions.push(region);
  }
  
  // Final pass: remove nested/overlapping regions
  // Sort by area (larger first) to keep larger regions when overlapping
  regions.sort((a, b) => (b.w * b.h) - (a.w * a.h));
  
  const finalRegionsClean = [];
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    let overlaps = false;
    
    // Check if this region overlaps significantly with any already added region
    for (let j = 0; j < finalRegionsClean.length; j++) {
      const existing = finalRegionsClean[j];
      
      // Calculate overlap area
      const overlapX = Math.max(0, Math.min(region.x + region.w, existing.x + existing.w) - Math.max(region.x, existing.x));
      const overlapY = Math.max(0, Math.min(region.y + region.h, existing.y + existing.h) - Math.max(region.y, existing.y));
      const overlapArea = overlapX * overlapY;
      const regionArea = region.w * region.h;
      
      // If more than 30% overlap, skip this region (reduced from 50% for more precision)
      // This prevents nested highlights
      if (overlapArea > regionArea * 0.3) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      finalRegionsClean.push(region);
    }
  }
  
  return finalRegionsClean;
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
 * Uses multiple ignore options to filter browser rendering noise
 */
function compareSquares(img1, img2) {
  return new Promise((resolve) => {
    if (typeof resemble === 'undefined') {
      console.error('Resemble.js not loaded!');
      resolve(0);
      return;
    }
    
    // Use multiple ignore options to filter browser rendering differences:
    // - ignoreAntialiasing: ignores font anti-aliasing differences
    // - ignoreLess: ignores very small differences (browser rendering noise)
    // Using both together provides better filtering
    resemble(img1)
      .compareTo(img2)
      .ignoreAntialiasing() // Ignore font anti-aliasing differences
      .ignoreLess() // Ignore very small differences (browser rendering noise)
      .onComplete((data) => {
        resolve(parseFloat(data.misMatchPercentage));
      });
  });
}

/**
 * Update highlight positions based on current scroll position
 */
function updateHighlightPositions() {
  if (!overlay || !highlightData) return;
  
  const { changedSquares, imageWidth, imageHeight } = highlightData;
  
  // Update scale factors in case window was resized
  const currentScaleX = window.innerWidth / imageWidth;
  const currentScaleY = window.innerHeight / imageHeight;
  
  // Update overlay size to cover entire document
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );
  const docWidth = Math.max(
    document.body.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.clientWidth,
    document.documentElement.scrollWidth,
    document.documentElement.offsetWidth
  );
  
  overlay.style.width = `${docWidth}px`;
  overlay.style.height = `${docHeight}px`;
  
  // Update each highlight position
  // Highlights use absolute positions on the page (calculated from screenshot scroll position)
  // So they don't need to be updated when scrolling - they stay in the same place on the page
  const highlights = overlay.querySelectorAll('.tabnabbing-highlight');
  highlights.forEach((highlight, index) => {
    const square = changedSquares[index];
    if (!square) return;
    
    // Recalculate absolute position using current scale (for window resize)
    // Use stored screenshot scroll position, not current scroll
    const absoluteX = square.x * currentScaleX + (window.screenshotScrollX || 0);
    const absoluteY = square.y * currentScaleY + screenshotScrollY;
    const scaledW = square.w * currentScaleX;
    const scaledH = square.h * currentScaleY;
    
    highlight.style.left = `${absoluteX}px`;
    highlight.style.top = `${absoluteY}px`;
    highlight.style.width = `${scaledW}px`;
    highlight.style.height = `${scaledH}px`;
    // Ensure no border on resize updates
    highlight.style.border = 'none';
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
  
  // Calculate scale factors
  const scaleX = window.innerWidth / imageWidth;
  const scaleY = window.innerHeight / imageHeight;
  
  console.log(`Scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
  
  // Store highlight data for scroll updates
  highlightData = {
    changedSquares,
    imageWidth,
    imageHeight,
    scaleX,
    scaleY
  };
  
  // Create new overlay container
  overlay = document.createElement('div');
  overlay.id = 'tabnabbing-overlay';
  
  // Calculate document dimensions
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );
  const docWidth = Math.max(
    document.body.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.clientWidth,
    document.documentElement.scrollWidth,
    document.documentElement.offsetWidth
  );
  
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: ${docWidth}px;
    height: ${docHeight}px;
    pointer-events: none;
    z-index: 2147483647;
  `;
  
  // Store scroll position when screenshot was taken (use current scroll as approximation)
  // Note: This assumes screenshot was taken at current scroll position
  screenshotScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  const screenshotScrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
  window.screenshotScrollX = screenshotScrollX; // Store for updateHighlightPositions
  
  // Create highlights for each changed square
  changedSquares.forEach((square, index) => {
    const highlight = document.createElement('div');
    highlight.className = 'tabnabbing-highlight';
    
    // Calculate absolute position on page
    // Screenshot coordinates are relative to viewport, so add scroll offset
    const absoluteX = square.x * scaleX + screenshotScrollX;
    const absoluteY = square.y * scaleY + screenshotScrollY;
    const scaledW = square.w * scaleX;
    const scaledH = square.h * scaleY;
    
    // Use red color as shown in image - no border, just semi-transparent red overlay
    highlight.style.cssText = `
      position: absolute;
      left: ${absoluteX}px;
      top: ${absoluteY}px;
      width: ${scaledW}px;
      height: ${scaledH}px;
      background: rgba(255, 0, 0, 0.35);
      pointer-events: none;
      z-index: 2147483647;
    `;
    
    overlay.appendChild(highlight);
    
    if (index < 3) {
      console.log(`Highlight ${index}: (${absoluteX.toFixed(0)}, ${absoluteY.toFixed(0)}) ${scaledW.toFixed(0)}x${scaledH.toFixed(0)} - ${(square.maxDiff || square.diff || 0).toFixed(1)}%`);
    }
  });
  
  // Ensure body has relative positioning for absolute children
  const bodyStyle = window.getComputedStyle(document.body);
  if (bodyStyle.position === 'static') {
    document.body.style.position = 'relative';
  }
  
  document.body.appendChild(overlay);
  console.log(`Highlighted ${changedSquares.length} changes`);
  
  // Set up scroll and resize listeners
  // Scroll listener: update overlay size if document height changes
  // Resize listener: recalculate highlight positions and sizes
  if (!window.tabnabbingScrollListener) {
    window.tabnabbingScrollListener = () => {
      // Update overlay size on scroll (in case content loads dynamically)
      if (overlay) {
        const docHeight = Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );
        const docWidth = Math.max(
          document.body.scrollWidth,
          document.body.offsetWidth,
          document.documentElement.clientWidth,
          document.documentElement.scrollWidth,
          document.documentElement.offsetWidth
        );
        overlay.style.width = `${docWidth}px`;
        overlay.style.height = `${docHeight}px`;
      }
    };
    window.tabnabbingResizeListener = updateHighlightPositions;
    window.addEventListener('scroll', window.tabnabbingScrollListener, { passive: true });
    window.addEventListener('resize', window.tabnabbingResizeListener, { passive: true });
  }
  
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
  highlightData = null;
  
  // Remove scroll listeners if no highlights
  if (window.tabnabbingScrollListener) {
    window.removeEventListener('scroll', window.tabnabbingScrollListener);
    window.tabnabbingScrollListener = null;
  }
  if (window.tabnabbingResizeListener) {
    window.removeEventListener('resize', window.tabnabbingResizeListener);
    window.tabnabbingResizeListener = null;
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

