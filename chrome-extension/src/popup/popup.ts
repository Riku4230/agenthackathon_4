document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  // Check current status
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response?.isActive) {
      statusIndicator?.classList.add('active');
      if (statusText) {
        statusText.textContent = 'Agent is active';
      }
    } else {
      statusIndicator?.classList.remove('active');
      if (statusText) {
        statusText.textContent = 'Agent is inactive';
      }
    }
  });

  // Check if on Google Meet
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab?.url?.includes('meet.google.com')) {
      // On Google Meet
      if (statusText && !statusIndicator?.classList.contains('active')) {
        statusText.textContent = 'Ready - Click "AI Agent" in Meet';
      }
    } else {
      // Not on Google Meet
      if (statusText) {
        statusText.textContent = 'Open Google Meet to use';
      }
    }
  });
});
