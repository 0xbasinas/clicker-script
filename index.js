let clickInterval;
let findButtonTimeout;
let mutationObserver;
const maxAttempts=10;
let attempt=0;
const findButtonDelay=2000;
const visibilityCheckDelay=100;
// Primary CSS selector
const buttonSelector='#content > div > div.main-container > nav > div.navigation-controls.universal-control-panel__navigation-controls > button.uikit-primary-button.uikit-primary-button_size_medium.navigation-controls__button.uikit-primary-button_next.navigation-controls__button_next';
// Alternative selectors for fallback
const alternativeSelectors=[
	'button.uikit-primary-button.uikit-primary-button_next.navigation-controls__button_next',
	'button.navigation-controls__button_next',
	'button.uikit-primary-button_next',
	'nav button.uikit-primary-button_next',
	'div.navigation-controls button.uikit-primary-button_next'
];
// XPath selectors as fallback
const xpathSelectors=[
	'//*[@id="content"]/div/div[1]/nav/div[2]/button[2]',
	'/html/body/div[2]/div/div[1]/nav/div[2]/button[2]',
	'//button[contains(@class, "uikit-primary-button_next")]',
	'//button[contains(@class, "navigation-controls__button_next")]'
];
const durationMs=2*60*60*1000;
const startTimestamp=Date.now();
const endTimestamp=startTimestamp+durationMs;

function dispatchClickSequence(target){
	target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
	target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
	target.dispatchEvent(new MouseEvent('click',{bubbles:true}));
}

function isElementVisible(element){
	if(!element){
		return false;
	}
	const rect=element.getBoundingClientRect();
	const styles=getComputedStyle(element);
	const isInViewport=rect.width>0&&rect.height>0&&rect.top>=0&&rect.left>=0&&rect.bottom<=window.innerHeight&&rect.right<=window.innerWidth;
	const isVisible=styles.display!=='none'&&styles.visibility!=='hidden'&&styles.opacity!=='0'&&!element.hidden;
	return isInViewport&&isVisible;
}

function ensureInteractable(element){
	if(!element){
		return null;
	}
	let ancestor=element;
	while(ancestor){
		if(ancestor.hasAttribute && ancestor.hasAttribute('aria-hidden')){
			ancestor.removeAttribute('aria-hidden');
		}
		if(ancestor.hasAttribute && ancestor.hasAttribute('inert')){
			ancestor.removeAttribute('inert');
		}
		if(ancestor.style){
			ancestor.style.pointerEvents='auto';
			ancestor.style.visibility='visible';
			ancestor.style.display='';
			ancestor.style.opacity='1';
		}
		ancestor=ancestor.parentElement;
	}
	const focused=document.activeElement;
	if(focused && element.contains(focused) && typeof focused.blur==='function'){
		focused.blur();
	}
	if(element.disabled){
		element.disabled=false;
	}
	element.removeAttribute('aria-disabled');
	element.hidden=false;
	return element;
}

function evaluateXPath(xpath){
	try{
		const result=document.evaluate(xpath,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);
		return result.singleNodeValue;
	}catch(e){
		return null;
	}
}

function findButtonByCSSProperties(container){
	if(!container){
		container=document;
	}
	const buttons=container.querySelectorAll('button');
	for(const button of buttons){
		const styles=getComputedStyle(button);
		const bgColor=styles.backgroundColor;
		const hasPrimaryButtonClass=button.classList.contains('uikit-primary-button');
		const hasNextClass=button.classList.contains('uikit-primary-button_next')||button.classList.contains('navigation-controls__button_next');
		// Check for primary button background color (rgba(95,139,217,1) or similar)
		const isPrimaryBlue=bgColor.includes('rgb(95, 139, 217)')||bgColor.includes('rgba(95, 139, 217');
		if((hasPrimaryButtonClass&&hasNextClass)||(isPrimaryBlue&&hasNextClass)){
			return button;
		}
	}
	return null;
}

function findButtonInModalsAndOverlays(){
	// Search in common modal/overlay containers
	const modalSelectors=[
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
		'div[style*="z-index"]'
	];
	for(const selector of modalSelectors){
		const modals=document.querySelectorAll(selector);
		for(const modal of modals){
			const button=findButtonByCSSProperties(modal);
			if(button){
				return button;
			}
			// Also try direct selectors in modal
			for(const altSelector of alternativeSelectors){
				const matches=modal.querySelectorAll(altSelector);
				if(matches.length>0){
					return matches[0];
				}
			}
		}
	}
	return null;
}

function findButtonByPositionAndContext(){
	// Find navigation controls container first, then button within
	const navControls=document.querySelectorAll('div.navigation-controls, nav, [class*="navigation"]');
	for(const nav of navControls){
		const buttons=nav.querySelectorAll('button');
		for(const button of buttons){
			const hasNextClass=button.classList.contains('uikit-primary-button_next')||
				button.classList.contains('navigation-controls__button_next')||
				button.classList.contains('uikit-primary-button')&&button.textContent.trim()==='';
			if(hasNextClass){
				return button;
			}
		}
	}
	// Try finding by position (second button in navigation)
	const navs=document.querySelectorAll('nav, div[class*="navigation"]');
	for(const nav of navs){
		const buttons=Array.from(nav.querySelectorAll('button'));
		if(buttons.length>=2){
			const secondButton=buttons[1];
			if(secondButton.classList.contains('uikit-primary-button')){
				return secondButton;
			}
		}
	}
	return null;
}

function locateButton(){
	// Strategy 1: Try primary CSS selector
	let matches=document.querySelectorAll(buttonSelector);
	for(const candidate of matches){
		const interactable=ensureInteractable(candidate);
		if(interactable){
			return interactable;
		}
	}
	// Strategy 2: Try alternative CSS selectors
	for(const selector of alternativeSelectors){
		matches=document.querySelectorAll(selector);
		for(const candidate of matches){
			const interactable=ensureInteractable(candidate);
			if(interactable){
				return interactable;
			}
		}
	}
	// Strategy 3: Try XPath selectors
	for(const xpath of xpathSelectors){
		const element=evaluateXPath(xpath);
		if(element){
			const interactable=ensureInteractable(element);
			if(interactable){
				return interactable;
			}
		}
	}
	// Strategy 4: Search in modals and overlays (for alarms/alerts)
	const buttonInModal=findButtonInModalsAndOverlays();
	if(buttonInModal){
		const interactable=ensureInteractable(buttonInModal);
		if(interactable){
			return interactable;
		}
	}
	// Strategy 5: Find by position and context
	const buttonByContext=findButtonByPositionAndContext();
	if(buttonByContext){
		const interactable=ensureInteractable(buttonByContext);
		if(interactable){
			return interactable;
		}
	}
	// Strategy 6: Fallback to CSS property matching (searches entire document)
	const buttonByProps=findButtonByCSSProperties();
	if(buttonByProps){
		const interactable=ensureInteractable(buttonByProps);
		if(interactable){
			return interactable;
		}
	}
	// Strategy 7: Last resort - find any button with next classes anywhere
	const allButtons=document.querySelectorAll('button');
	for(const button of allButtons){
		if(button.classList.contains('uikit-primary-button_next')||
			button.classList.contains('navigation-controls__button_next')){
			const interactable=ensureInteractable(button);
			if(interactable){
				return interactable;
			}
		}
	}
	return null;
}

function formatDuration(ms){
	const totalSeconds=Math.max(Math.floor(ms/1000),0);
	const hours=String(Math.floor(totalSeconds/3600)).padStart(2,'0');
	const minutes=String(Math.floor(totalSeconds%3600/60)).padStart(2,'0');
	const seconds=String(totalSeconds%60).padStart(2,'0');
	return hours+':'+minutes+':'+seconds;
}

function logCountdown(prefix){
	const remaining=endTimestamp-Date.now();
	console.log(prefix+' | Time remaining: '+formatDuration(remaining));
	if(remaining<=0){
		console.log('Runtime limit reached. Stopping clicker.');
		stopClicker();
	}
}

function hasTimeRemaining(){
	return Date.now()<endTimestamp;
}

function setupMutationObserver(){
	if(mutationObserver){
		mutationObserver.disconnect();
	}
	mutationObserver=new MutationObserver((mutations)=>{
		const button=locateButton();
		if(button&&!clickInterval){
			console.log('Button appeared via DOM mutation. Attempting to click...');
			attempt=0;
			startClicker();
		}
	});
	mutationObserver.observe(document.body,{
		childList:true,
		subtree:true,
		attributes:true,
		attributeFilter:['class','style','aria-hidden','hidden']
	});
}

function waitForPageReady(callback){
	if(document.readyState==='complete'||document.readyState==='interactive'){
		setTimeout(callback,visibilityCheckDelay);
	}else{
		document.addEventListener('DOMContentLoaded',()=>setTimeout(callback,visibilityCheckDelay));
		window.addEventListener('load',()=>setTimeout(callback,visibilityCheckDelay));
	}
}

function startClicker(){
	if(!hasTimeRemaining()){
		console.warn('Runtime limit already exceeded. Clicker will not start.');
		return;
	}
	attempt++;
	const button=locateButton();
	if(button){
		console.log('Button found on attempt '+attempt+'.');
		dispatchClickSequence(button);
		logCountdown('Button clicked immediately');
		clearTimeout(findButtonTimeout);
		if(mutationObserver){
			mutationObserver.disconnect();
			mutationObserver=null;
		}
		clickInterval=setInterval(()=>{
			if(!hasTimeRemaining()){
				console.log('Runtime limit reached during interval. Stopping clicker.');
				stopClicker();
				return;
			}
			const nextButton=locateButton();
			if(nextButton){
				dispatchClickSequence(nextButton);
				logCountdown('Button clicked after delay');
			}else{
				console.warn('Button disappeared! Re-enabling mutation observer and retrying...');
				setupMutationObserver();
				// Don't stop, just wait for button to reappear
			}
		},30000);
	}else if(attempt<maxAttempts){
		console.warn('Button not found on attempt '+attempt+'. Retrying in '+findButtonDelay/1000+' seconds...');
		if(attempt===1){
			setupMutationObserver();
		}
		findButtonTimeout=setTimeout(startClicker,findButtonDelay);
	}else{
		console.warn('Button not found after multiple attempts. Keeping mutation observer active to watch for button appearance...');
		setupMutationObserver();
		// Don't stop completely, keep watching for button
		findButtonTimeout=setTimeout(()=>{
			attempt=0;
			startClicker();
		},findButtonDelay*2);
	}
}

function stopClicker(){
	if(clickInterval){
		clearInterval(clickInterval);
		clickInterval=null;
		console.log('Clicker stopped.');
	}
	if(findButtonTimeout){
		clearTimeout(findButtonTimeout);
		findButtonTimeout=null;
	}
	if(mutationObserver){
		mutationObserver.disconnect();
		mutationObserver=null;
	}
	attempt=0;
}

// Wait for page to be ready before starting
waitForPageReady(()=>{
	console.log('Page ready. Starting button finder...');
	startClicker();
});
