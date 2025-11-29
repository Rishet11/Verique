// Verique Content Script

// Verdict configurations
const VERDICT_CONFIG = {
  strongly_supported: {
    label: 'Strongly Supported',
    color: '#15803d',
    bgColor: 'rgba(21, 128, 61, 0.1)',
  },
  supported: {
    label: 'Supported',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.1)',
  },
  mixed: {
    label: 'Mixed',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.1)',
  },
  weak: {
    label: 'Weak Evidence',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
  },
  contradicted: {
    label: 'Contradicted',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
  },
  outdated: {
    label: 'Outdated',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.1)',
  },
  not_verifiable: {
    label: 'Not Verifiable',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
  }
};

// State
let currentResults = null;
let sidebarVisible = false;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getSelection':
      sendResponse({ text: window.getSelection().toString() });
      break;
      
    case 'getPageContent':
      sendResponse({ content: getMainContent() });
      break;
      
    case 'showLoading':
      showLoadingOverlay(request.message);
      break;
      
    case 'showResults':
      hideLoadingOverlay();
      currentResults = request.result;
      showSidebar(request.result, request.originalText);
      break;
      
    case 'showError':
      hideLoadingOverlay();
      showErrorToast(request.message);
      break;
      
    case 'toggleSidebar':
      if (sidebarVisible) {
        hideSidebar();
      } else if (currentResults) {
        showSidebar(currentResults);
      }
      sendResponse({ visible: sidebarVisible });
      break;
  }
  
  return true;
});

function getMainContent() {
  // Try to get main content area
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.innerText.length > 200) {
      return element.innerText;
    }
  }
  
  // Fallback to body text
  return document.body.innerText;
}

function showLoadingOverlay(message) {
  const existing = document.getElementById('trustlens-loading');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'trustlens-loading';
  overlay.innerHTML = `
    <div class="trustlens-loading-content">
      <div class="trustlens-spinner"></div>
      <p>${message || 'Verifying content...'}</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('trustlens-loading');
  if (overlay) overlay.remove();
}

function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'trustlens-toast trustlens-toast-error';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 5000);
}

function showSidebar(result) {
  const existing = document.getElementById('trustlens-sidebar');
  if (existing) existing.remove();
  
  sidebarVisible = true;
  
  const sidebar = document.createElement('div');
  sidebar.id = 'trustlens-sidebar';
  
  // Generate claim cards HTML
  const claimCards = result.claims.map(claim => {
    const config = VERDICT_CONFIG[claim.verdict];
    return `
      <div class="trustlens-claim-card" data-claim-id="${claim.id}">
        <div class="trustlens-verdict-badge" style="background-color: ${config.bgColor}; color: ${config.color}">
          ${config.label}
        </div>
        <p class="trustlens-claim-text">"${claim.text}"</p>
        <p class="trustlens-claim-reasoning">${claim.reasoning}</p>
        <div class="trustlens-confidence">
          ${Math.round(claim.confidence * 100)}% confidence
        </div>
      </div>
    `;
  }).join('');
  
  sidebar.innerHTML = `
    <div class="trustlens-sidebar-header">
      <div class="trustlens-logo">
        <span class="trustlens-icon">🛡️</span>
        <span class="trustlens-title">TrustLens</span>
      </div>
      <button class="trustlens-close-btn" id="trustlens-close">✕</button>
    </div>
    
    <div class="trustlens-score-section">
      <div class="trustlens-score ${getScoreClass(result.page_score)}">
        ${result.page_score}
      </div>
      <div class="trustlens-score-label">Trust Score</div>
    </div>
    
    <div class="trustlens-summary">
      <div class="trustlens-summary-item">
        <span class="trustlens-summary-count">${result.claims.length}</span>
        <span class="trustlens-summary-label">Claims Found</span>
      </div>
      <div class="trustlens-summary-item">
        <span class="trustlens-summary-count">${result.metadata.sources_checked}</span>
        <span class="trustlens-summary-label">Sources Checked</span>
      </div>
    </div>
    
    <div class="trustlens-claims-section">
      <h3>Verified Claims</h3>
      <div class="trustlens-claims-list">
        ${claimCards}
      </div>
    </div>
    
    <div class="trustlens-footer">
      <a href="https://trustlens.io" target="_blank">Powered by TrustLens AI</a>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  
  // Add close handler
  document.getElementById('trustlens-close').addEventListener('click', hideSidebar);
  
  // Add click handlers to claim cards
  sidebar.querySelectorAll('.trustlens-claim-card').forEach(card => {
    card.addEventListener('click', () => {
      const claimId = card.dataset.claimId;
      const claim = result.claims.find(c => c.id === claimId);
      if (claim) {
        highlightClaimInPage(claim);
      }
    });
  });
}

function hideSidebar() {
  const sidebar = document.getElementById('trustlens-sidebar');
  if (sidebar) sidebar.remove();
  sidebarVisible = false;
  
  // Remove any highlights
  document.querySelectorAll('.trustlens-highlight').forEach(el => {
    el.replaceWith(document.createTextNode(el.textContent));
  });
}

function getScoreClass(score) {
  if (score >= 70) return 'trustlens-score-high';
  if (score >= 50) return 'trustlens-score-medium';
  return 'trustlens-score-low';
}

function highlightClaimInPage(claim) {
  // Simple text highlight - search for claim text in page
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent;
    const index = text.indexOf(claim.text);
    
    if (index !== -1) {
      const config = VERDICT_CONFIG[claim.verdict];
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + claim.text.length);
      
      const highlight = document.createElement('span');
      highlight.className = 'trustlens-highlight';
      highlight.style.backgroundColor = config.bgColor;
      highlight.style.borderBottom = `2px solid ${config.color}`;
      highlight.title = `${config.label}: ${claim.reasoning}`;
      
      range.surroundContents(highlight);
      
      // Scroll to highlight
      highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      break;
    }
  }
}
