// Verique Background Service Worker

const API_BASE = 'http://127.0.0.1:8000';

// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'verify-selection',
    title: 'Verify with Verique',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'verify-page',
    title: 'Verify entire page',
    contexts: ['page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'verify-selection' && info.selectionText) {
    await verifyContent(tab.id, info.selectionText);
  } else if (info.menuItemId === 'verify-page') {
    chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, async (response) => {
      if (response && response.content) {
        await verifyContent(tab.id, response.content);
      }
    });
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (command === 'verify-selection') {
    chrome.tabs.sendMessage(tab.id, { action: 'getSelection' }, async (response) => {
      if (response && response.text) {
        await verifyContent(tab.id, response.text);
      }
    });
  } else if (command === 'verify-page') {
    chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, async (response) => {
      if (response && response.content) {
        await verifyContent(tab.id, response.content);
      }
    });
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'verify') {
    verifyContentAsync(request.text, request.url)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getApiStatus') {
    checkApiStatus()
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function verifyContent(tabId, text) {
  // Show loading state
  chrome.tabs.sendMessage(tabId, { 
    action: 'showLoading',
    message: 'Analyzing claims...'
  });

  try {
    const result = await verifyContentAsync(text);
    
    // Send results to content script for highlighting
    chrome.tabs.sendMessage(tabId, {
      action: 'showResults',
      result: result,
      originalText: text
    });
  } catch (error) {
    chrome.tabs.sendMessage(tabId, {
      action: 'showError',
      message: error.message
    });
  }
}

async function verifyContentAsync(text, url = null) {
  try {
    const response = await fetch(`${API_BASE}/api/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        url: url,
        vertical: 'general'
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `Verification failed (${response.status})`);
    }

    return response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Could not connect to TrustLens backend. Is it running?');
    }
    throw error;
  }
}

async function checkApiStatus() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return { online: response.ok };
  } catch {
    return { online: false };
  }
}
