import './meet-detector.css';

interface AgentState {
  isActive: boolean;
  buttonElement: HTMLElement | null;
}

const state: AgentState = {
  isActive: false,
  buttonElement: null,
};

// Check if we're on a Google Meet page
function isGoogleMeet(): boolean {
  return window.location.hostname === 'meet.google.com' &&
         window.location.pathname.length > 1;
}

// Create and inject the agent button
function createAgentButton(): HTMLElement {
  const button = document.createElement('button');
  button.id = 'meet-artifact-agent-button';
  button.className = 'meet-artifact-button';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
    <span>AI Agent</span>
  `;
  button.title = 'Start AI Artifact Generator';

  button.addEventListener('click', handleButtonClick);

  return button;
}

// Handle button click
async function handleButtonClick(): Promise<void> {
  if (state.isActive) {
    // Stop the agent
    chrome.runtime.sendMessage({ type: 'STOP_AGENT' }, (response) => {
      if (response?.success) {
        updateButtonState(false);
      } else {
        console.error('Failed to stop agent:', response?.error);
      }
    });
  } else {
    // Start the agent
    chrome.runtime.sendMessage({ type: 'START_AGENT' }, (response) => {
      if (response?.success) {
        updateButtonState(true);
      } else {
        console.error('Failed to start agent:', response?.error);
        showError(response?.error || 'Failed to start agent');
      }
    });
  }
}

// Update button visual state
function updateButtonState(isActive: boolean): void {
  state.isActive = isActive;

  if (state.buttonElement) {
    if (isActive) {
      state.buttonElement.classList.add('active');
      state.buttonElement.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
        <span>Stop Agent</span>
      `;
    } else {
      state.buttonElement.classList.remove('active');
      state.buttonElement.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <span>AI Agent</span>
      `;
    }
  }
}

// Show error notification
function showError(message: string): void {
  const notification = document.createElement('div');
  notification.className = 'meet-artifact-notification error';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Inject button into the Meet UI
function injectButton(): void {
  // Wait for Meet UI to load
  const observer = new MutationObserver(() => {
    // Look for the Meet toolbar/controls area
    const toolbar = document.querySelector('[data-panel-id="toolbar"]') ||
                    document.querySelector('.GRqzff') || // Meeting controls
                    document.querySelector('[role="region"]');

    if (toolbar && !document.getElementById('meet-artifact-agent-button')) {
      state.buttonElement = createAgentButton();

      // Create a container for our button
      const container = document.createElement('div');
      container.className = 'meet-artifact-container';
      container.appendChild(state.buttonElement);

      // Try to insert in the toolbar, or fallback to fixed position
      const controlsWrapper = toolbar.querySelector('.NzPR9b') || toolbar;
      if (controlsWrapper) {
        controlsWrapper.appendChild(container);
      } else {
        document.body.appendChild(container);
      }

      // Check initial status
      chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
        if (response?.isActive) {
          updateButtonState(true);
        }
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also try immediately
  setTimeout(() => {
    if (!document.getElementById('meet-artifact-agent-button')) {
      state.buttonElement = createAgentButton();
      const container = document.createElement('div');
      container.className = 'meet-artifact-container fixed';
      container.appendChild(state.buttonElement);
      document.body.appendChild(container);
    }
  }, 3000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'AGENT_STARTED':
      updateButtonState(true);
      break;
    case 'AGENT_STOPPED':
      updateButtonState(false);
      break;
  }
});

// Initialize
if (isGoogleMeet()) {
  console.log('[Meet Artifact Generator] Detected Google Meet, injecting UI...');
  injectButton();
}
