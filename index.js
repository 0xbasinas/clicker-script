// Config
const BUTTON_SELECTOR =
  '#content > div > div.main-container > nav > div.navigation-controls.universal-control-panel__navigation-controls > button.uikit-primary-button.uikit-primary-button_size_medium.navigation-controls__button.uikit-primary-button_next.navigation-controls__button_next';

const MAX_ATTEMPTS = 10;
const FIND_BUTTON_DELAY_MS = 2000;
const CLICK_INTERVAL_MS = 30000;

// State
let clickInterval = null;
let findButtonTimeout = null;
let attempt = 0;

// Utils
function getButton() {
  return document.querySelector(BUTTON_SELECTOR);
}

function dispatchClick(el) {
  const opts = { bubbles: true };
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
}

function logAttempt(prefix = 'Attempt') {
  console.log(`${prefix} ${attempt}/${MAX_ATTEMPTS}`);
}

// Core
function startClicker() {
  attempt += 1;
  logAttempt('Searching. Attempt');

  const btn = getButton();

  if (btn) {
    console.log(`Button found on attempt ${attempt}.`);
    dispatchClick(btn);
    console.log('Button clicked immediately!');

    // Stop any pending find timeouts
    if (findButtonTimeout) {
      clearTimeout(findButtonTimeout);
      findButtonTimeout = null;
    }

    // Start periodic clicking
    if (clickInterval) clearInterval(clickInterval);
    clickInterval = setInterval(() => {
      const currentBtn = getButton();
      if (!currentBtn) {
        console.warn('Button disappeared! Stopping clicker.');
        stopClicker();
        return;
      }
      dispatchClick(currentBtn);
      console.log('Button clicked after delay!');
    }, CLICK_INTERVAL_MS);

    return;
  }

  // Not found: retry or stop
  if (attempt < MAX_ATTEMPTS) {
    console.warn(
      `Button not found on attempt ${attempt}. Retrying in ${
        FIND_BUTTON_DELAY_MS / 1000
      } seconds...`
    );
    if (findButtonTimeout) clearTimeout(findButtonTimeout);
    findButtonTimeout = setTimeout(startClicker, FIND_BUTTON_DELAY_MS);
  } else {
    console.error('Button not found after multiple attempts. Stopping clicker.');
    stopClicker();
  }
}

function stopClicker() {
  if (clickInterval) {
    clearInterval(clickInterval);
    clickInterval = null;
    console.log('Clicker stopped.');
  }
  if (findButtonTimeout) {
    clearTimeout(findButtonTimeout);
    findButtonTimeout = null;
  }
  attempt = 0;
}

// Kick off
startClicker();
