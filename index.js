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
				'button.uikit-primary-button.uikit-primary-button_size_medium.navigation-controls__button.uikit-primary-button_next',
				'button.navigation-controls__button_next',
				'button.uikit-primary-button_next',
				'nav button.uikit-primary-button_next',
				'div.navigation-controls button.uikit-primary-button_next',
				'button[class*="uikit-primary-button_next"]',
				'button[class*="navigation-controls__button_next"]',
				'button:has(span.uikit-primary-button__button-text)',
				'button:has(svg.uikit-primary-button__right-icon)'
			],
			xpathSelectors: [
				'//*[@id="content"]/div/div[1]/nav/div[2]/button[2]',
				'/html/body/div[2]/div/div[1]/nav/div[2]/button[2]',
				'//button[contains(@class, "uikit-primary-button_next")]',
				'//button[contains(@class, "navigation-controls__button_next")]',
				'//nav//button[contains(@class, "uikit-primary-button")][2]',
				'//button[contains(., "Next") and contains(@class, "uikit-primary-button")]',
				'//button[.//span[contains(text(), "Next")] and contains(@class, "uikit-primary-button_next")]'
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
			buttonText: 'Next', // Text content to match
			buttonTextSelector: 'span.uikit-primary-button__button-text', // Selector for text span
			buttonIconSelector: 'svg.uikit-primary-button__right-icon', // Selector for icon
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

		// Handle iframe elements
		if (element.__iframeContext) {
			const { document: iframeDoc } = element.__iframeContext;
			try {
				// Fix in iframe document context
				const mainContainers = iframeDoc.querySelectorAll('div.main-container, [class*="main-container"]');
				for (const container of mainContainers) {
					if (container.hasAttribute('aria-hidden') && element.closest('.main-container') === container) {
						container.removeAttribute('aria-hidden');
						this.log('DEBUG', 'Removed aria-hidden from main-container in iframe');
					}
					if (container.hasAttribute('inert')) {
						container.removeAttribute('inert');
					}
				}
			} catch (e) {
				this.log('DEBUG', 'Error fixing interactability in iframe:', e);
			}
		}

		try {
			// First, specifically fix main-container and other common containers
			const mainContainers = document.querySelectorAll('div.main-container, [class*="main-container"]');
			for (const container of mainContainers) {
				if (container.hasAttribute('aria-hidden') && element.closest('.main-container') === container) {
					container.removeAttribute('aria-hidden');
					this.log('DEBUG', 'Removed aria-hidden from main-container');
				}
				if (container.hasAttribute('inert')) {
					container.removeAttribute('inert');
				}
			}

			// Fix ancestor chain (go all the way up to document)
			let ancestor = element.parentElement;
			const ancestorsToFix = [];
			
			// Collect all ancestors first
			while (ancestor && ancestor !== document && ancestor !== document.documentElement) {
				ancestorsToFix.push(ancestor);
				ancestor = ancestor.parentElement;
			}

			// Fix all ancestors (from closest to furthest)
			for (const ancestor of ancestorsToFix) {
				if (ancestor.hasAttribute?.('aria-hidden')) {
					ancestor.removeAttribute('aria-hidden');
					this.log('DEBUG', `Removed aria-hidden from ancestor: ${ancestor.tagName}.${ancestor.className}`);
				}
				if (ancestor.hasAttribute?.('inert')) {
					ancestor.removeAttribute('inert');
					this.log('DEBUG', `Removed inert from ancestor: ${ancestor.tagName}.${ancestor.className}`);
				}
				if (ancestor.style) {
					// Only set if not already set to avoid overriding intentional styles
					if (ancestor.style.pointerEvents === 'none') {
						ancestor.style.pointerEvents = 'auto';
					}
					if (ancestor.style.visibility === 'hidden') {
						ancestor.style.visibility = 'visible';
					}
					if (ancestor.style.display === 'none') {
						ancestor.style.display = '';
					}
					if (ancestor.style.opacity === '0') {
						ancestor.style.opacity = '1';
					}
				}
			}

			// Fix element itself
			if (element.disabled) {
				element.disabled = false;
			}
			element.removeAttribute('aria-disabled');
			element.removeAttribute('aria-hidden');
			element.hidden = false;
			
			// Ensure element is focusable
			if (element.tabIndex < 0) {
				element.tabIndex = 0;
			}
			
			// Blur any focused element that might interfere (but not the target element)
			const activeElement = document.activeElement;
			if (activeElement && activeElement !== element && element.contains(activeElement)) {
				activeElement.blur?.();
			}

			// Force a reflow to ensure changes take effect
			void element.offsetHeight;

			return element;
		} catch (e) {
			this.log('ERROR', 'Error ensuring interactability:', e);
			return null;
		}
	}

	// Enhanced click simulation with more realistic events
	dispatchClickSequence(target) {
		if (!target) return false;

		// Check if this is an iframe element
		if (target.__iframeContext) {
			return this.dispatchClickInIframe(target.__iframeContext);
		}

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

	// Find button by visual position (rightmost button in navigation)
	findButtonByVisualPosition() {
		try {
			const navAreas = document.querySelectorAll('nav, .navigation-controls, [class*="navigation"]');
			
			for (const nav of navAreas) {
				const buttons = Array.from(nav.querySelectorAll('button'));
				if (buttons.length === 0) continue;

				// Sort buttons by their right edge position (rightmost first)
				const buttonsWithPosition = buttons.map(button => {
					const rect = button.getBoundingClientRect();
					return { button, right: rect.right, top: rect.top };
				}).filter(item => item.right > 0 && item.top > 0); // Only visible buttons

				if (buttonsWithPosition.length === 0) continue;

				// Sort by right position (descending), then by top (ascending)
				buttonsWithPosition.sort((a, b) => {
					if (Math.abs(a.right - b.right) < 10) { // Same column
						return a.top - b.top;
					}
					return b.right - a.right; // Rightmost first
				});

				// Get the rightmost button that's a primary button
				for (const { button } of buttonsWithPosition) {
					if (button.classList.contains('uikit-primary-button') ||
						this.config.requiredClasses.some(cls => button.classList.contains(cls))) {
						return button;
					}
				}

				// Fallback: just return the rightmost button
				if (buttonsWithPosition.length > 0) {
					return buttonsWithPosition[0].button;
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Visual position search error:', e);
		}
		return null;
	}

	// Find button by searching for elements with arrow icons or right-pointing indicators
	findButtonByDirectionalIndicators() {
		try {
			// Look for SVG icons that indicate "next" or "forward"
			const svgSelectors = [
				'svg[viewBox*="24"]',
				'svg path[d*="M8"]',
				'svg path[d*="L14"]',
				'svg[class*="right"]',
				'svg[class*="next"]',
				'svg[class*="arrow"]',
			];

			for (const selector of svgSelectors) {
				try {
					const svgs = document.querySelectorAll(selector);
					for (const svg of svgs) {
						// Check if SVG is in a button
						const button = svg.closest('button');
						if (button && button.classList.contains('uikit-primary-button')) {
							return button;
						}
					}
				} catch (e) {
					// Continue if selector fails
				}
			}

			// Look for buttons with ::after or ::before pseudo-elements that might contain arrows
			// (This is harder to detect, but we can check for classes that suggest arrows)
			const buttons = document.querySelectorAll('button');
			for (const button of buttons) {
				const classes = Array.from(button.classList);
				if (classes.some(cls => 
					cls.includes('right') || 
					cls.includes('next') || 
					cls.includes('forward') ||
					cls.includes('arrow')
				)) {
					if (button.classList.contains('uikit-primary-button') ||
						button.closest('nav') ||
						button.closest('.navigation-controls')) {
						return button;
					}
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Directional indicators search error:', e);
		}
		return null;
	}

	// Get all accessible iframes (handles cross-origin restrictions)
	getAccessibleIframes() {
		const iframes = [];
		try {
			const allIframes = document.querySelectorAll('iframe');
			for (const iframe of allIframes) {
				try {
					// Try to access iframe content (will throw if cross-origin)
					const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
					if (iframeDoc) {
						iframes.push({
							iframe: iframe,
							document: iframeDoc,
							window: iframe.contentWindow
						});
						
						// Also search for nested iframes within this iframe
						const nestedIframes = iframeDoc.querySelectorAll('iframe');
						for (const nestedIframe of nestedIframes) {
							try {
								const nestedDoc = nestedIframe.contentDocument || nestedIframe.contentWindow?.document;
								if (nestedDoc) {
									iframes.push({
										iframe: nestedIframe,
										document: nestedDoc,
										window: nestedIframe.contentWindow,
										parentIframe: iframe
									});
								}
							} catch (e) {
								// Nested cross-origin iframe
							}
						}
					}
				} catch (e) {
					// Cross-origin iframe, can't access content directly
					this.log('DEBUG', 'Cross-origin iframe detected, skipping:', iframe.src || iframe.name);
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Error getting iframes:', e);
		}
		return iframes;
	}

	// Search for iframes that might contain the player (by src, name, or id)
	findPlayerIframes() {
		const playerIframes = [];
		try {
			const allIframes = document.querySelectorAll('iframe');
			for (const iframe of allIframes) {
				const src = (iframe.src || '').toLowerCase();
				const name = (iframe.name || '').toLowerCase();
				const id = (iframe.id || '').toLowerCase();
				
				// Check for common player-related keywords
				if (src.includes('player') || src.includes('presentation') || 
					name.includes('player') || name.includes('presentation') ||
					id.includes('player') || id.includes('presentation') ||
					src.includes('ispring') || name.includes('ispring') || id.includes('ispring')) {
					
					try {
						const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
						if (iframeDoc) {
							playerIframes.push({
								iframe: iframe,
								document: iframeDoc,
								window: iframe.contentWindow
							});
						}
					} catch (e) {
						// Cross-origin
					}
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Error finding player iframes:', e);
		}
		return playerIframes;
	}

	// Search for button in iframes
	findButtonInIframes() {
		try {
			// First, try player-specific iframes (higher priority)
			const playerIframes = this.findPlayerIframes();
			const allIframes = this.getAccessibleIframes();
			
			// Combine and prioritize player iframes
			const iframesToSearch = [...playerIframes, ...allIframes.filter(iframe => 
				!playerIframes.some(pf => pf.iframe === iframe.iframe)
			)];
			
			for (const { iframe, document: iframeDoc, window: iframeWindow } of iframesToSearch) {
				try {
					// Strategy 1: Try primary selector in iframe
					const primaryMatch = iframeDoc.querySelector(this.config.primarySelector);
					if (primaryMatch) {
						this.log('DEBUG', 'Found button in iframe using primary selector');
						return { element: primaryMatch, iframe: iframe, document: iframeDoc, window: iframeWindow };
					}

					// Strategy 2: Search by text content in iframe
					const searchText = this.config.buttonText.toLowerCase();
					const searchVariations = [
						searchText,
						'next',
						'следующий',
						'siguiente',
						'suivant',
						'weiter',
						'avanti',
					];

					const allButtons = iframeDoc.querySelectorAll('button, [role="button"], [onclick]');
					for (const button of allButtons) {
						const textContent = this.normalizeText(button.textContent);
						const ariaLabel = this.normalizeText(button.getAttribute('aria-label') || '');
						const title = this.normalizeText(button.getAttribute('title') || '');
						
						const combinedText = `${textContent} ${ariaLabel} ${title}`;
						
						if (searchVariations.some(variation => combinedText.includes(variation))) {
							if (button.classList.contains('uikit-primary-button') ||
								button.closest('nav') ||
								button.closest('.navigation-controls')) {
								this.log('DEBUG', 'Found button in iframe by text content');
								return { element: button, iframe: iframe, document: iframeDoc, window: iframeWindow };
							}
						}
					}

					// Strategy 3: Search by class names in iframe
					for (const selector of this.config.alternativeSelectors) {
						try {
							const matches = iframeDoc.querySelectorAll(selector);
							if (matches.length > 0) {
								this.log('DEBUG', `Found button in iframe using selector: ${selector}`);
								return { element: matches[0], iframe: iframe, document: iframeDoc, window: iframeWindow };
							}
						} catch (e) {
							// Some selectors might fail, continue
						}
					}

					// Strategy 4: Search by XPath in iframe
					for (const xpath of this.config.xpathSelectors) {
						try {
							const result = iframeDoc.evaluate(
								xpath,
								iframeDoc,
								null,
								XPathResult.FIRST_ORDERED_NODE_TYPE,
								null
							);
							const element = result.singleNodeValue;
							if (element) {
								this.log('DEBUG', 'Found button in iframe using XPath');
								return { element: element, iframe: iframe, document: iframeDoc, window: iframeWindow };
							}
						} catch (e) {
							// XPath might fail, continue
						}
					}

					// Strategy 5: Search in player-specific containers (playerView, content)
					const playerContainers = iframeDoc.querySelectorAll('#playerView, #content, [id*="player"], [class*="player"]');
					for (const container of playerContainers) {
						// Search for buttons with "Next" text in container
						const buttons = container.querySelectorAll('button, [role="button"], [onclick]');
						for (const button of buttons) {
							const text = this.normalizeText(button.textContent);
							if (text.includes('next') || text.includes('следующий') || text.includes('siguiente')) {
								this.log('DEBUG', 'Found button with "Next" text in player container in iframe');
								return { element: button, iframe: iframe, document: iframeDoc, window: iframeWindow };
							}
						}
					}

					// Strategy 6: Search for any element containing "Next" text in iframe
					const allElements = iframeDoc.querySelectorAll('*');
					for (const element of allElements) {
						const text = this.normalizeText(element.textContent);
						if (text.includes('next') || text.includes('следующий') || text.includes('siguiente')) {
							// Check if it's clickable
							if (element.tagName === 'BUTTON' ||
								element.getAttribute('role') === 'button' ||
								element.onclick ||
								element.classList.contains('button')) {
								this.log('DEBUG', 'Found clickable element with "Next" text in iframe');
								return { element: element, iframe: iframe, document: iframeDoc, window: iframeWindow };
							}
							// Find closest clickable parent
							const clickable = element.closest('button, [role="button"], [onclick]');
							if (clickable) {
								this.log('DEBUG', 'Found clickable parent of "Next" text in iframe');
								return { element: clickable, iframe: iframe, document: iframeDoc, window: iframeWindow };
							}
						}
					}
				} catch (e) {
					this.log('DEBUG', 'Error searching in iframe:', e);
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Error finding button in iframes:', e);
		}
		return null;
	}

	// Enhanced click for iframe elements
	dispatchClickInIframe(iframeContext) {
		if (!iframeContext || !iframeContext.element) return false;

		try {
			const { element, iframe, document: iframeDoc, window: iframeWindow } = iframeContext;

			// Ensure element is interactable
			const interactable = this.ensureInteractable(element);
			if (!interactable) return false;

			// Try clicking in iframe context
			if (iframeWindow) {
				// Dispatch events in iframe window context
				const events = [
					{ type: 'mouseover', bubbles: true, cancelable: true },
					{ type: 'mousedown', bubbles: true, cancelable: true, button: 0 },
					{ type: 'focus', bubbles: true, cancelable: true },
					{ type: 'mouseup', bubbles: true, cancelable: true, button: 0 },
					{ type: 'click', bubbles: true, cancelable: true, button: 0 }
				];

				for (const eventConfig of events) {
					const rect = element.getBoundingClientRect();
					const event = new iframeWindow.MouseEvent(eventConfig.type, {
						view: iframeWindow,
						bubbles: eventConfig.bubbles,
						cancelable: eventConfig.cancelable,
						button: eventConfig.button || 0,
						buttons: 1,
						clientX: rect.left + rect.width / 2,
						clientY: rect.top + rect.height / 2
					});
					element.dispatchEvent(event);
				}

				// Also try native click
				if (typeof element.click === 'function') {
					element.click();
				}

				// Also try clicking from parent window (focus iframe first)
				iframe.focus();
				iframeWindow.focus();
				
				return true;
			}
		} catch (e) {
			this.log('ERROR', 'Error dispatching click in iframe:', e);
		}
		return false;
	}

	// Normalize text for comparison (remove extra whitespace, lowercase)
	normalizeText(text) {
		if (!text) return '';
		return text.toLowerCase().replace(/\s+/g, ' ').trim();
	}

	// Find button by text content with multiple strategies
	findButtonByTextContent() {
		try {
			const searchText = this.config.buttonText.toLowerCase();
			const searchVariations = [
				searchText,
				'next',
				'следующий', // Russian
				'siguiente', // Spanish
				'suivant', // French
				'weiter', // German
				'avanti', // Italian
			];

			// Method 1: Find span with text, then get parent button
			const textSpans = document.querySelectorAll(this.config.buttonTextSelector);
			for (const span of textSpans) {
				const spanText = this.normalizeText(span.textContent);
				if (searchVariations.some(variation => spanText.includes(variation))) {
					const button = span.closest('button');
					if (button && button.classList.contains('uikit-primary-button')) {
						return button;
					}
				}
			}

			// Method 2: Find all buttons and check text content (case-insensitive, partial match)
			const allButtons = document.querySelectorAll('button');
			for (const button of allButtons) {
				const textContent = this.normalizeText(button.textContent);
				// Check if button contains any variation of "Next" text
				if (searchVariations.some(variation => textContent.includes(variation))) {
					// Verify it has the right classes
					if (button.classList.contains('uikit-primary-button') &&
						(this.config.requiredClasses.some(cls => button.classList.contains(cls)))) {
						return button;
					}
				}
			}

			// Method 3: Find by XPath with text content (case-insensitive)
			for (const variation of searchVariations) {
				const xpath = `//button[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "${variation}") and contains(@class, "uikit-primary-button")]`;
				const element = this.evaluateXPath(xpath);
				if (element) return element;
			}

			// Method 4: Search by aria-label
			for (const button of allButtons) {
				const ariaLabel = this.normalizeText(button.getAttribute('aria-label') || '');
				if (searchVariations.some(variation => ariaLabel.includes(variation))) {
					if (button.classList.contains('uikit-primary-button')) {
						return button;
					}
				}
			}

			// Method 5: Search by title attribute
			for (const button of allButtons) {
				const title = this.normalizeText(button.getAttribute('title') || '');
				if (searchVariations.some(variation => title.includes(variation))) {
					if (button.classList.contains('uikit-primary-button')) {
						return button;
					}
				}
			}

			// Method 6: Search by data attributes
			for (const button of allButtons) {
				const dataText = this.normalizeText(
					button.getAttribute('data-text') || 
					button.getAttribute('data-label') || 
					button.getAttribute('data-name') || 
					''
				);
				if (searchVariations.some(variation => dataText.includes(variation))) {
					if (button.classList.contains('uikit-primary-button')) {
						return button;
					}
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Text content search error:', e);
		}
		return null;
	}

	// Find any clickable element containing "Next" text (not just buttons)
	findElementByTextContent() {
		try {
			const searchText = this.config.buttonText.toLowerCase();
			const searchVariations = [
				searchText,
				'next',
				'следующий',
				'siguiente',
				'suivant',
				'weiter',
				'avanti',
			];

			// Search for any clickable element containing the text
			const clickableSelectors = [
				'button',
				'a[role="button"]',
				'[role="button"]',
				'div[onclick]',
				'span[onclick]',
				'div[class*="button"]',
				'span[class*="button"]',
			];

			for (const selector of clickableSelectors) {
				try {
					const elements = document.querySelectorAll(selector);
					for (const element of elements) {
						const textContent = this.normalizeText(element.textContent);
						const ariaLabel = this.normalizeText(element.getAttribute('aria-label') || '');
						const title = this.normalizeText(element.getAttribute('title') || '');
						
						const combinedText = `${textContent} ${ariaLabel} ${title}`;
						
						if (searchVariations.some(variation => combinedText.includes(variation))) {
							// Check if it's a primary button or has navigation classes
							if (element.classList.contains('uikit-primary-button') ||
								element.classList.contains('navigation-controls__button') ||
								this.config.requiredClasses.some(cls => element.classList.contains(cls))) {
								return element;
							}
							
							// Also check if it's in a navigation context
							if (element.closest('nav') || element.closest('.navigation-controls')) {
								return element;
							}
						}
					}
				} catch (e) {
					// Some selectors might fail, continue
					this.log('DEBUG', `Selector failed: ${selector}`, e);
				}
			}

			// Search using XPath for any element containing text
			for (const variation of searchVariations) {
				const xpath = `//*[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "${variation}") and (self::button or @role="button" or @onclick or contains(@class, "button"))]`;
				const element = this.evaluateXPath(xpath);
				if (element) {
					// Verify it's in a navigation context or has relevant classes
					if (element.closest('nav') || 
						element.closest('.navigation-controls') ||
						element.classList.contains('uikit-primary-button')) {
						return element;
					}
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Element text content search error:', e);
		}
		return null;
	}

	// Find element by searching for text nodes containing "Next"
	findElementByTextNode() {
		try {
			const searchText = this.config.buttonText.toLowerCase();
			const searchVariations = [
				searchText,
				'next',
				'следующий',
				'siguiente',
				'suivant',
				'weiter',
				'avanti',
			];

			// Walk through all text nodes
			const walker = document.createTreeWalker(
				document.body,
				NodeFilter.SHOW_TEXT,
				{
					acceptNode: (node) => {
						const text = this.normalizeText(node.textContent);
						return searchVariations.some(variation => text.includes(variation))
							? NodeFilter.FILTER_ACCEPT
							: NodeFilter.FILTER_REJECT;
					}
				}
			);

			let textNode;
			while (textNode = walker.nextNode()) {
				// Find the closest clickable parent
				let parent = textNode.parentElement;
				while (parent && parent !== document.body) {
					// Check if parent is clickable
					if (parent.tagName === 'BUTTON' ||
						parent.getAttribute('role') === 'button' ||
						parent.onclick ||
						parent.classList.contains('button') ||
						parent.classList.contains('uikit-primary-button')) {
						
						// Verify it's in navigation context or has relevant classes
						if (parent.classList.contains('uikit-primary-button') ||
							parent.closest('nav') ||
							parent.closest('.navigation-controls')) {
							return parent;
						}
					}
					parent = parent.parentElement;
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Text node search error:', e);
		}
		return null;
	}

	// Find button by SVG icon
	findButtonByIcon() {
		try {
			// Find SVG with the right icon class
			const icons = document.querySelectorAll(this.config.buttonIconSelector);
			for (const icon of icons) {
				// Check if it has the arrow path (M8 4L14 10L8 16)
				const path = icon.querySelector('path');
				if (path) {
					const pathD = path.getAttribute('d');
					// Check for arrow path pattern
					if (pathD && (pathD.includes('M8 4') || pathD.includes('L14 10') || pathD.includes('L8 16'))) {
						const button = icon.closest('button');
						if (button && button.classList.contains('uikit-primary-button')) {
							return button;
						}
					}
				}
			}

			// Alternative: Find buttons containing SVG with stroke
			const buttons = document.querySelectorAll('button.uikit-primary-button');
			for (const button of buttons) {
				const svg = button.querySelector('svg');
				if (svg) {
					const path = svg.querySelector('path[stroke]');
					if (path && path.getAttribute('stroke') === 'currentColor') {
						// Likely the right icon
						if (this.config.requiredClasses.some(cls => button.classList.contains(cls))) {
							return button;
						}
					}
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Icon search error:', e);
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
			// Strategy 2: Find by text content "Next" (very reliable) - enhanced
			() => this.findButtonByTextContent(),
			// Strategy 3: Find any clickable element containing "Next" text
			() => this.findElementByTextContent(),
			// Strategy 4: Find by searching text nodes containing "Next"
			() => this.findElementByTextNode(),
			// Strategy 5: Find by SVG icon (very reliable)
			() => this.findButtonByIcon(),
			// Strategy 6: Search in iframes
			() => {
				const iframeResult = this.findButtonInIframes();
				if (iframeResult) {
					// Store iframe context for later use
					iframeResult.element.__iframeContext = iframeResult;
					return iframeResult.element;
				}
				return null;
			},
			// Strategy 6: Alternative CSS selectors
			() => {
				for (const selector of this.config.alternativeSelectors) {
					try {
						const matches = document.querySelectorAll(selector);
						if (matches.length > 0) return matches[0];
					} catch (e) {
						// Some selectors like :has() might not be supported, skip
						this.log('DEBUG', `Selector not supported: ${selector}`);
					}
				}
				return null;
			},
			// Strategy 7: XPath selectors
			() => {
				for (const xpath of this.config.xpathSelectors) {
					const element = this.evaluateXPath(xpath);
					if (element) return element;
				}
				return null;
			},
			// Strategy 8: Modals and overlays
			() => this.findButtonInModalsAndOverlays(),
			// Strategy 9: Position and context
			() => this.findButtonByPositionAndContext(),
			// Strategy 10: Visual position (rightmost button)
			() => this.findButtonByVisualPosition(),
			// Strategy 11: Directional indicators (arrows, right icons)
			() => this.findButtonByDirectionalIndicators(),
			// Strategy 12: CSS property matching
			() => this.findButtonByCSSProperties(),
			// Strategy 13: Search for elements with "Next" in navigation areas
			() => {
				try {
					const navAreas = document.querySelectorAll('nav, .navigation-controls, [class*="navigation"]');
					for (const nav of navAreas) {
						const allElements = nav.querySelectorAll('*');
						for (const element of allElements) {
							const text = this.normalizeText(element.textContent);
							if (text.includes('next') || text.includes('следующий') || text.includes('siguiente')) {
								// Check if it's clickable
								if (element.tagName === 'BUTTON' ||
									element.getAttribute('role') === 'button' ||
									element.onclick ||
									element.classList.contains('button')) {
									return element;
								}
								// Find closest clickable parent
								const clickable = element.closest('button, [role="button"], [onclick]');
								if (clickable) return clickable;
							}
						}
					}
				} catch (e) {
					this.log('DEBUG', 'Navigation area search error:', e);
				}
				return null;
			},
			// Strategy 14: Last resort - any button with required classes
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

	// Fix aria-hidden issues proactively
	fixAriaHiddenIssues() {
		try {
			// Find all main-container elements and remove aria-hidden
			const mainContainers = document.querySelectorAll('div.main-container, [class*="main-container"]');
			for (const container of mainContainers) {
				if (container.hasAttribute('aria-hidden')) {
					container.removeAttribute('aria-hidden');
					this.log('DEBUG', 'Proactively removed aria-hidden from main-container');
				}
			}

			// Find buttons that might be affected
			const buttons = document.querySelectorAll('button.uikit-primary-button_next, button.navigation-controls__button_next');
			for (const button of buttons) {
				// Check if button or its ancestors have aria-hidden
				let ancestor = button.parentElement;
				while (ancestor && ancestor !== document.body) {
					if (ancestor.hasAttribute('aria-hidden')) {
						ancestor.removeAttribute('aria-hidden');
						this.log('DEBUG', `Removed aria-hidden from button ancestor: ${ancestor.className}`);
					}
					ancestor = ancestor.parentElement;
				}
			}
		} catch (e) {
			this.log('DEBUG', 'Error fixing aria-hidden issues:', e);
		}
	}

	// Setup mutation observer with debouncing
	setupMutationObserver() {
		if (this.state.mutationObserver) {
			this.state.mutationObserver.disconnect();
		}

		let debounceTimer;
		this.state.mutationObserver = new MutationObserver((mutations) => {
			// Check for aria-hidden changes and fix them immediately
			for (const mutation of mutations) {
				if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
					const target = mutation.target;
					if (target.hasAttribute('aria-hidden') && 
						(target.classList.contains('main-container') || 
						 target.querySelector?.('button.uikit-primary-button_next'))) {
						// Fix immediately if it affects our button
						this.fixAriaHiddenIssues();
					}
				}
			}

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
			attributeFilter: ['class', 'style', 'aria-hidden', 'hidden', 'disabled', 'inert']
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

		// Fix aria-hidden issues before attempting to find/click
		this.fixAriaHiddenIssues();

		const button = this.locateButton();
		if (button) {
			// Ensure button is interactable (this also fixes aria-hidden)
			const interactableButton = this.ensureInteractable(button);
			if (interactableButton) {
				const success = this.dispatchClickSequence(interactableButton);
				if (success) {
					this.state.clickCount++;
					this.state.lastButtonFound = Date.now();
					const remaining = this.state.endTimestamp - Date.now();
					this.log('INFO', `Button clicked (${this.state.clickCount} total) | Time remaining: ${this.formatDuration(remaining)}`);
				} else {
					this.log('WARN', 'Click dispatch failed');
				}
			} else {
				this.log('WARN', 'Button found but could not be made interactable');
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

		// Fix aria-hidden issues before attempting to find button
		this.fixAriaHiddenIssues();

		const button = this.locateButton();
		if (button) {
			this.log('INFO', `Button found on attempt ${this.state.attempt}`);
			// Ensure button is interactable before clicking
			const interactableButton = this.ensureInteractable(button);
			if (interactableButton) {
				this.dispatchClickSequence(interactableButton);
				this.state.clickCount++;
				this.state.lastButtonFound = Date.now();
			} else {
				this.log('WARN', 'Button found but could not be made interactable on start');
				return;
			}

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
	
	// Fix aria-hidden issues proactively
	clicker.fixAriaHiddenIssues();
	
	// Setup visibility change handler
	document.addEventListener('visibilitychange', clicker.handleVisibilityChange);
	
	// Start the clicker
	clicker.start();
});

// Export for potential external control
if (typeof window !== 'undefined') {
	window.buttonClicker = clicker;
}
