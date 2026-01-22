document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const errorMessage = document.getElementById('errorMessage');
  const actionButton = document.getElementById('actionButton') as HTMLButtonElement;
  const buttonText = document.getElementById('buttonText');

  let isActive = false;
  let currentMeetTabId: number | null = null;

  function updateUI(active: boolean, onMeetPage: boolean) {
    isActive = active;

    if (active) {
      statusIndicator?.classList.add('active');
      if (statusText) statusText.textContent = 'Agent is active';
      actionButton?.classList.add('stop');
      if (buttonText) buttonText.textContent = 'Stop Agent';
      actionButton.disabled = false;
    } else if (onMeetPage) {
      statusIndicator?.classList.remove('active');
      if (statusText) statusText.textContent = 'Ready to start';
      actionButton?.classList.remove('stop');
      if (buttonText) buttonText.textContent = 'Start Agent';
      actionButton.disabled = false;
    } else {
      statusIndicator?.classList.remove('active');
      if (statusText) statusText.textContent = 'Open Google Meet to use';
      actionButton?.classList.remove('stop');
      if (buttonText) buttonText.textContent = 'Start Agent';
      actionButton.disabled = true;
    }
  }

  function showError(message: string) {
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
    }
  }

  function hideError() {
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }

  // Check current status
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response?.isActive) {
      updateUI(true, true);
    }
  });

  // Check if on Google Meet
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const onMeetPage = currentTab?.url?.includes('meet.google.com') ?? false;
    currentMeetTabId = currentTab?.id ?? null;

    if (!isActive) {
      updateUI(false, onMeetPage);
    }
  });

  // Handle button click
  actionButton?.addEventListener('click', async () => {
    hideError();
    actionButton.disabled = true;

    try {
      if (isActive) {
        // Stop agent
        const response = await chrome.runtime.sendMessage({ type: 'STOP_AGENT' });
        if (response?.success) {
          updateUI(false, true);
        } else {
          showError(response?.error || 'Failed to stop agent');
          actionButton.disabled = false;
        }
      } else {
        // Start agent - need to get the current Meet tab
        if (!currentMeetTabId) {
          showError('No Google Meet tab found');
          actionButton.disabled = false;
          return;
        }

        // Send message with the tab ID
        const response = await chrome.runtime.sendMessage({
          type: 'START_AGENT_FROM_POPUP',
          tabId: currentMeetTabId,
        });

        if (response?.success) {
          updateUI(true, true);
        } else {
          showError(response?.error || 'Failed to start agent');
          actionButton.disabled = false;
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Unknown error');
      actionButton.disabled = false;
    }
  });
});
