/**
 * Advanced Button Clicker Script
 * Automatically finds and clicks navigation buttons with multiple fallback strategies
 */

class ButtonClicker {
	constructor(config = {}) {
		// Configuration
		this.config = {
			// Selectors
			primarySelector: '#content > div > div.main-container > nav > div.navigation-controls.universal-control-panel__navigation-controls > button.uikit-primary-button.uikit-primary-button_size_medium.navigation-controls__button.uikit-primary-button_next.navigation-controls__button_next',
			alternativeSelectors: [
				'button.uikit-primary-button.uikit-primary-button_next.navigation-controls__button_next',
				'button.navigation-controls__button_next',
				'button.uikit-primary-button_next',
				'nav button.uikit-primary-button_next',
				'div.navigation-controls button.uikit-primary-button_next',
				'button[class*="uikit-primary-button_next"]',
				'button[class*="navigation-controls__button_next"]'
			],
			xpathSelectors: [
				'//*[@id="content"]/div/div[1]/nav/div[2]/button[2]',
				'/html/body/div[2]/div/div[1]/nav/div[2]/button[2]',
				'//button[contains(@class, "uikit-primary-button_next")]',
				'//button[contains(@class, "navigation-controls__button_next")]',
				'//nav//button[contains(@class, "uikit-primary-button")][2]'
			],
			// Timing
			clickInterval: 30000, // 30 seconds
			findButtonDelay: 2000, // 2 seconds
			visibilityCheckDelay: 100,
			maxAttempts: 10,
			// Runtime
			durationMs: 2 * 60 * 60 * 1000, // 2 hours
			// Button properties
			primaryButtonColor: 'rgba(95, 139, 217',
			requiredClasses: ['uikit-primary-button_next', 'navigation-controls__button_next'],
			// Logging
			debug: false,
			...config
		};

		// State
		this.state = {
			clickInterval: null,
			findButtonTimeout: null,
			mutationObserver: null,
			attempt: 0,
			startTimestamp: Date.now(),
			endTimestamp: Date.now() + this.config.durationMs,
			isRunning: false,
			lastButtonFound: null,
			clickCount: 0
		};

		// Bind methods
		this.start = this.start.bind(this);
		this.stop = this.stop.bind(this);
		this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
	}

	// Logging utilities
	log(level, message, ...args) {
		const timestamp = new Date().toISOString();
		const prefix = `[${timestamp}] [${level}]`;
		if (level === 'ERROR' || level === 'WARN') {
			console.warn(prefix, message, ...args);
		} else if (this.config.debug || level === 'INFO') {
			console.log(prefix, message, ...args);
		}
	}

	// Format duration helper
	formatDuration(ms) {
		const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
		const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
		const minutes = String(Math.floor(totalSeconds % 3600 / 60)).padStart(2, '0');
		const seconds = String(totalSeconds % 60).padStart(2, '0');
		return `${hours}:${minutes}:${seconds}`;
	}

	// Check if time remaining
	hasTimeRemaining() {
		return Date.now() < this.state.endTimestamp;
	}

	// Enhanced visibility check
	isElementVisible(element) {
		if (!element || !element.getBoundingClientRect) return false;

		try {
			const rect = element.getBoundingClientRect();
			const styles = window.getComputedStyle(element);
			
			const hasSize = rect.width > 0 && rect.height > 0;
			const inViewport = rect.top >= 0 && 
				rect.left >= 0 && 
				rect.bottom <= window.innerHeight && 
				rect.right <= window.innerWidth;
			const isVisible = styles.display !== 'none' && 
				styles.visibility !== 'hidden' && 
				styles.opacity !== '0' && 
				!element.hidden &&
				parseFloat(styles.opacity) > 0;

			return hasSize && (inViewport || true) && isVisible; // Allow off-screen elements
		} catch (e) {
			this.log('DEBUG', 'Visibility check error:', e);
			return false;
		}
	}

	// Enhanced interactability fixer
	ensureInteractable(element) {
		if (!element) return null;

		try {
			// Fix ancestor chain
			let ancestor = element;
			while (ancestor && ancestor !== document.body) {
				if (ancestor.hasAttribute?.('aria-hidden')) {
					ancestor.removeAttribute('aria-hidden');
				}
				if (ancestor.hasAttribute?.('inert')) {
					ancestor.removeAttribute('inert');
				}
				if (ancestor.style) {
					ancestor.style.pointerEvents = 'auto';
					ancestor.style.visibility = 'visible';
					ancestor.style.display = ancestor.style.display || '';
					ancestor.style.opacity = '1';
				}
				ancestor = ancestor.parentElement;
			}

			// Fix element itself
			if (element.disabled) {
				element.disabled = false;
			}
			element.removeAttribute('aria-disabled');
			element.hidden = false;
			
			// Blur any focused element that might interfere
			if (document.activeElement && element.contains(document.activeElement)) {
				document.activeElement.blur?.();
			}

			return element;
		} catch (e) {
			this.log('ERROR', 'Error ensuring interactability:', e);
			return null;
		}
	}

	// Enhanced click simulation with more realistic events
	dispatchClickSequence(target) {
		if (!target) return false;

		try {
			const events = [
				{ type: 'mouseover', bubbles: true, cancelable: true },
				{ type: 'mousedown', bubbles: true, cancelable: true, button: 0 },
				{ type: 'focus', bubbles: true, cancelable: true },
				{ type: 'mouseup', bubbles: true, cancelable: true, button: 0 },
				{ type: 'click', bubbles: true, cancelable: true, button: 0 }
			];

			for (const eventConfig of events) {
				const event = new MouseEvent(eventConfig.type, {
					view: window,
					bubbles: eventConfig.bubbles,
					cancelable: eventConfig.cancelable,
					button: eventConfig.button || 0,
					buttons: 1,
					clientX: target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2,
					clientY: target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2
				});
				target.dispatchEvent(event);
			}

			// Also try native click as fallback
			if (typeof target.click === 'function') {
				target.click();
			}

			return true;
		} catch (e) {
			this.log('ERROR', 'Error dispatching click:', e);
			return false;
		}
	}

	// XPath evaluator with error handling
	evaluateXPath(xpath) {
		try {
			const result = document.evaluate(
				xpath,
				document,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			);
			return result.singleNodeValue;
		} catch (e) {
			this.log('DEBUG', 'XPath evaluation error:', e.message);
			return null;
		}
	}

	// Find button by CSS properties
	findButtonByCSSProperties(container = document) {
		try {
			const buttons = container.querySelectorAll('button');
			for (const button of buttons) {
				const styles = window.getComputedStyle(button);
				const bgColor = styles.backgroundColor;
				const hasPrimaryButtonClass = button.classList.contains('uikit-primary-button');
				const hasNextClass = this.config.requiredClasses.some(cls => 
					button.classList.contains(cls)
				);
				const isPrimaryBlue = bgColor.includes(this.config.primaryButtonColor);

				if ((hasPrimaryButtonClass && hasNextClass) || (isPrimaryBlue && hasNextClass)) {
					return button;
				}
			}
		} catch (e) {
			this.log('DEBUG', 'CSS property search error:', e);
		}
		return null;
	}

	// Find button in modals and overlays
	findButtonInModalsAndOverlays() {
		const modalSelectors = [
			'[role="dialog"]',
			'.modal',
			'.overlay',
			'.popup',
			'[class*="modal"]',
			'[class*="overlay"]',
			'[class*="popup"]',
			'[class*="dialog"]',
			'[class*="alarm"]',
			'[class*="alert"]',
			'div[style*="z-index"]',
			'[class*="notification"]'
		];

		for (const selector of modalSelectors) {
			try {
				const modals = document.querySelectorAll(selector);
				for (const modal of modals) {
					// Try CSS property matching in modal
					const button = this.findButtonByCSSProperties(modal);
					if (button) return button;

					// Try direct selectors in modal
					for (const altSelector of this.config.alternativeSelectors) {
						const matches = modal.querySelectorAll(altSelector);
						if (matches.length > 0) return matches[0];
					}
				}
			} catch (e) {
				this.log('DEBUG', 'Modal search error:', e);
			}
		}
		return null;
	}

	// Find button by position and context
	findButtonByPositionAndContext() {
		try {
			const navControls = document.querySelectorAll(
				'div.navigation-controls, nav, [class*="navigation"]'
			);

			for (const nav of navControls) {
				const buttons = nav.querySelectorAll('button');
				for (const button of buttons) {
					const hasNextClass = this.config.requiredClasses.some(cls =>
						button.classList.contains(cls)
					) || (button.classList.contains('uikit-primary-button') && 
						!button.textContent.trim());

					if (hasNextClass) return button;
				}
			}

			// Try position-based (second button in navigation)
			const navs = document.querySelectorAll('nav, div[class*="navigation"]');
			for (const nav of navs) {
				const buttons = Array.from(nav.querySelectorAll('button'));
				if (buttons.length >= 2) {
					const secondButton = buttons[1];
					if (secondButton.classList.contains('uikit-primary-button')) {
						return secondButton;
					}
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Context search error:', e);
		}
		return null;
	}

	// Main button locator with all strategies
	locateButton() {
		const strategies = [
			// Strategy 1: Primary CSS selector
			() => {
				const matches = document.querySelectorAll(this.config.primarySelector);
				return Array.from(matches)[0] || null;
			},
			// Strategy 2: Alternative CSS selectors
			() => {
				for (const selector of this.config.alternativeSelectors) {
					const matches = document.querySelectorAll(selector);
					if (matches.length > 0) return matches[0];
				}
				return null;
			},
			// Strategy 3: XPath selectors
			() => {
				for (const xpath of this.config.xpathSelectors) {
					const element = this.evaluateXPath(xpath);
					if (element) return element;
				}
				return null;
			},
			// Strategy 4: Modals and overlays
			() => this.findButtonInModalsAndOverlays(),
			// Strategy 5: Position and context
			() => this.findButtonByPositionAndContext(),
			// Strategy 6: CSS property matching
			() => this.findButtonByCSSProperties(),
			// Strategy 7: Last resort - any button with required classes
			() => {
				const allButtons = document.querySelectorAll('button');
				for (const button of allButtons) {
					if (this.config.requiredClasses.some(cls => 
						button.classList.contains(cls)
					)) {
						return button;
					}
				}
				return null;
			}
		];

		for (let i = 0; i < strategies.length; i++) {
			try {
				const element = strategies[i]();
				if (element) {
					const interactable = this.ensureInteractable(element);
					if (interactable) {
						this.log('DEBUG', `Button found using strategy ${i + 1}`);
						return interactable;
					}
				}
			} catch (e) {
				this.log('DEBUG', `Strategy ${i + 1} error:`, e);
			}
		}

		return null;
	}

	// Setup mutation observer with debouncing
	setupMutationObserver() {
		if (this.state.mutationObserver) {
			this.state.mutationObserver.disconnect();
		}

		let debounceTimer;
		this.state.mutationObserver = new MutationObserver((mutations) => {
			// Debounce to avoid excessive checks
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				if (!this.state.isRunning || !this.state.clickInterval) {
					const button = this.locateButton();
					if (button) {
						this.log('INFO', 'Button appeared via DOM mutation');
						this.state.attempt = 0;
						this.start();
					}
				}
			}, 500);
		});

		this.state.mutationObserver.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class', 'style', 'aria-hidden', 'hidden', 'disabled']
		});

		this.log('DEBUG', 'Mutation observer activated');
	}

	// Handle page visibility changes
	handleVisibilityChange() {
		if (document.hidden) {
			this.log('INFO', 'Page hidden, pausing checks');
		} else {
			this.log('INFO', 'Page visible, resuming checks');
			if (this.state.isRunning && !this.state.clickInterval) {
				this.start();
			}
		}
	}

	// Wait for page ready
	waitForPageReady(callback) {
		if (document.readyState === 'complete' || document.readyState === 'interactive') {
			setTimeout(callback, this.config.visibilityCheckDelay);
		} else {
			const onReady = () => setTimeout(callback, this.config.visibilityCheckDelay);
			document.addEventListener('DOMContentLoaded', onReady, { once: true });
			window.addEventListener('load', onReady, { once: true });
		}
	}

	// Main clicker loop
	performClick() {
		if (!this.hasTimeRemaining()) {
			this.log('INFO', 'Runtime limit reached');
			this.stop();
			return;
		}

		const button = this.locateButton();
		if (button) {
			const success = this.dispatchClickSequence(button);
			if (success) {
				this.state.clickCount++;
				this.state.lastButtonFound = Date.now();
				const remaining = this.state.endTimestamp - Date.now();
				this.log('INFO', `Button clicked (${this.state.clickCount} total) | Time remaining: ${this.formatDuration(remaining)}`);
			} else {
				this.log('WARN', 'Click dispatch failed');
			}
		} else {
			this.log('WARN', 'Button not found during interval');
			this.setupMutationObserver();
		}
	}

	// Start the clicker
	start() {
		if (!this.hasTimeRemaining()) {
			this.log('WARN', 'Runtime limit already exceeded');
			return;
		}

		if (this.state.isRunning && this.state.clickInterval) {
			this.log('DEBUG', 'Clicker already running');
			return;
		}

		this.state.attempt++;
		this.state.isRunning = true;

		const button = this.locateButton();
		if (button) {
			this.log('INFO', `Button found on attempt ${this.state.attempt}`);
			this.dispatchClickSequence(button);
			this.state.clickCount++;
			this.state.lastButtonFound = Date.now();

			// Clear any pending timeouts
			if (this.state.findButtonTimeout) {
				clearTimeout(this.state.findButtonTimeout);
				this.state.findButtonTimeout = null;
			}

			// Disconnect mutation observer (we found it)
			if (this.state.mutationObserver) {
				this.state.mutationObserver.disconnect();
				this.state.mutationObserver = null;
			}

			// Start interval
			this.state.clickInterval = setInterval(() => {
				this.performClick();
			}, this.config.clickInterval);

			const remaining = this.state.endTimestamp - Date.now();
			this.log('INFO', `Clicker started | Time remaining: ${this.formatDuration(remaining)}`);
		} else if (this.state.attempt < this.config.maxAttempts) {
			this.log('WARN', `Button not found on attempt ${this.state.attempt}. Retrying in ${this.config.findButtonDelay / 1000}s...`);
			
			if (this.state.attempt === 1) {
				this.setupMutationObserver();
			}

			this.state.findButtonTimeout = setTimeout(() => {
				this.start();
			}, this.config.findButtonDelay);
		} else {
			this.log('WARN', 'Button not found after multiple attempts. Keeping mutation observer active...');
			this.setupMutationObserver();
			
			// Reset attempts and retry later
			this.state.findButtonTimeout = setTimeout(() => {
				this.state.attempt = 0;
				this.start();
			}, this.config.findButtonDelay * 2);
		}
	}

	// Stop the clicker
	stop() {
		this.state.isRunning = false;

		if (this.state.clickInterval) {
			clearInterval(this.state.clickInterval);
			this.state.clickInterval = null;
		}

		if (this.state.findButtonTimeout) {
			clearTimeout(this.state.findButtonTimeout);
			this.state.findButtonTimeout = null;
		}

		if (this.state.mutationObserver) {
			this.state.mutationObserver.disconnect();
			this.state.mutationObserver = null;
		}

		this.log('INFO', `Clicker stopped. Total clicks: ${this.state.clickCount}`);
		this.state.attempt = 0;
	}
}

// Initialize and start
const clicker = new ButtonClicker({
	debug: false // Set to true for verbose logging
});

// Wait for page ready and start
clicker.waitForPageReady(() => {
	clicker.log('INFO', 'Page ready. Starting button finder...');
	
	// Setup visibility change handler
	document.addEventListener('visibilitychange', clicker.handleVisibilityChange);
	
	// Start the clicker
	clicker.start();
});

// Export for potential external control
if (typeof window !== 'undefined') {
	window.buttonClicker = clicker;
}
