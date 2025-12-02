let clickInterval, findButtonTimeout, maxAttempts = 10, attempt = 0, findButtonDelay = 2000;
function startClicker() {
  attempt++;
  const button = document.querySelector('#content > div > div.main-container > nav > div.navigation-controls.universal-control-panel__navigation-controls > button.uikit-primary-button.uikit-primary-button_size_medium.navigation-controls__button.uikit-primary-button_next.navigation-controls__button_next');
  if (button) {
    console.log(`Button found on attempt ${attempt}.`);
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    console.log('Button clicked immediately!');
    clearTimeout(findButtonTimeout);
    clickInterval = setInterval(() => {
      const recurringButton = document.querySelector('#content > div > div.main-container > nav > div.navigation-controls.universal-control-panel__navigation-controls > button.uikit-primary-button.uikit-primary-button_size_medium.navigation-controls__button.uikit-primary-button_next.navigation-controls__button_next');
      if (recurringButton) {
        recurringButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        recurringButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        recurringButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        console.log('Button clicked after delay!');
      } else {
        console.warn('Button disappeared! Stopping clicker.');
        stopClicker();
      }
    }, 30000);
  } else if (attempt < maxAttempts) {
    console.warn(`Button not found on attempt ${attempt}. Retrying in ${findButtonDelay / 1000} seconds...`);
    findButtonTimeout = setTimeout(startClicker, findButtonDelay);
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
startClicker();
