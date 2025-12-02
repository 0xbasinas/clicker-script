let clickInterval;
let findButtonTimeout;
const maxAttempts=10;
let attempt=0;
const findButtonDelay=2000;
const buttonSelector='#content > div > div.main-container > nav > div.navigation-controls.universal-control-panel__navigation-controls > button.uikit-primary-button.uikit-primary-button_size_medium.navigation-controls__button.uikit-primary-button_next.navigation-controls__button_next';

function dispatchClickSequence(target){
	target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
	target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
	target.dispatchEvent(new MouseEvent('click',{bubbles:true}));
}

function normalizeVisibility(candidate){
	const hiddenAncestor=candidate.closest('[aria-hidden="true"]');
	if(hiddenAncestor){
		hiddenAncestor.removeAttribute('aria-hidden');
		hiddenAncestor.style.pointerEvents='auto';
		hiddenAncestor.style.visibility='visible';
	}
	return candidate.offsetParent!==null||candidate.getClientRects().length>0?candidate:null;
}

function locateButton(){
	const matches=document.querySelectorAll(buttonSelector);
	for(const candidate of matches){
		const visible=normalizeVisibility(candidate);
		if(visible){
			return visible;
		}
	}
	return null;
}

function startClicker(){
	attempt++;
	const button=locateButton();
	if(button){
		console.log('Button found on attempt '+attempt+'.');
		dispatchClickSequence(button);
		console.log('Button clicked immediately!');
		clearTimeout(findButtonTimeout);
		clickInterval=setInterval(()=>{
			const nextButton=locateButton();
			if(nextButton){
				dispatchClickSequence(nextButton);
				console.log('Button clicked after delay!');
			}else{
				console.warn('Button disappeared! Stopping clicker.');
				stopClicker();
			}
		},30000);
	}else if(attempt<maxAttempts){
		console.warn('Button not found on attempt '+attempt+'. Retrying in '+findButtonDelay/1000+' seconds...');
		findButtonTimeout=setTimeout(startClicker,findButtonDelay);
	}else{
		console.error('Button not found after multiple attempts. Stopping clicker.');
		stopClicker();
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
	attempt=0;
}

startClicker();
