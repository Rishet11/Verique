// Verique Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const apiStatus = document.getElementById('api-status');
  const verifyInput = document.getElementById('verify-input');
  const verifyBtn = document.getElementById('verify-btn');
  const verifyPageBtn = document.getElementById('verify-page-btn');
  const verifySelectionBtn = document.getElementById('verify-selection-btn');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const errorMessage = document.getElementById('error-message');

  // Check API status
  const status = await chrome.runtime.sendMessage({ action: 'getApiStatus' });
  if (status.online) {
    apiStatus.classList.add('online');
    apiStatus.querySelector('.status-text').textContent = 'API Online';
  } else {
    apiStatus.classList.add('offline');
    apiStatus.querySelector('.status-text').textContent = 'API Offline';
  }

  // Verify text from input
  verifyBtn.addEventListener('click', async () => {
    const text = verifyInput.value.trim();
    if (!text) return;

    await verifyContent(text);
  });

  // Verify entire page
  verifyPageBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, async (response) => {
      if (response && response.content) {
        await verifyContent(response.content);
      } else {
        showError('Could not extract page content');
      }
    });
  });

  // Verify selection
  verifySelectionBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: 'getSelection' }, async (response) => {
      if (response && response.text) {
        await verifyContent(response.text);
      } else {
        showError('No text selected on page');
      }
    });
  });

  async function verifyContent(text) {
    showLoading();
    hideError();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const result = await chrome.runtime.sendMessage({
        action: 'verify',
        text: text,
        url: tab.url
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Send results to content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'showResults',
        result: result,
        originalText: text
      });

      // Close popup
      window.close();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  }

  function showLoading() {
    loading.classList.remove('hidden');
    verifyBtn.disabled = true;
    verifyPageBtn.disabled = true;
    verifySelectionBtn.disabled = true;
  }

  function hideLoading() {
    loading.classList.add('hidden');
    verifyBtn.disabled = false;
    verifyPageBtn.disabled = false;
    verifySelectionBtn.disabled = false;
  }

  function showError(message) {
    error.classList.remove('hidden');
    errorMessage.textContent = message;
  }

  function hideError() {
    error.classList.add('hidden');
  }
});
