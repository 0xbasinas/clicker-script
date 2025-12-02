let clickInterval;
let findButtonTimeout;
const maxAttempts=10;
let attempt=0;
const findButtonDelay=2000;
const buttonSelector='#content > div > div.main-container > nav > div.navigation-controls.universal-control-panel__navigation-controls > button.uikit-primary-button.uikit-primary-button_size_medium.navigation-controls__button.uikit-primary-button_next.navigation-controls__button_next';
const candidateSelectors=[
	buttonSelector,
	'#content nav button.navigation-controls__button_next',
	'nav button.navigation-controls__button_next',
	'button.navigation-controls__button_next',
	'#content nav button[aria-label*="next" i]',
	'nav button[aria-label*="next" i]',
	'#content nav button',
	'nav button',
	'button[aria-label*="next" i]',
	'button.uikit-primary-button_next',
	'#content button',
	'button'
];
const textHints=['next','continue','go next','next question','next task'];
const durationMs=2*60*60*1000;
const startTimestamp=Date.now();
const endTimestamp=startTimestamp+durationMs;

function dispatchClickSequence(target){
	target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
	target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
	target.dispatchEvent(new MouseEvent('click',{bubbles:true}));
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
	return element;
}

function candidateScore(element){
	if(!element){
		return 0;
	}
	let score=0;
	if(element.matches(buttonSelector)){
		score+=60;
	}
	if(element.matches('button.navigation-controls__button_next')){
		score+=30;
	}
	if(element.matches('button.uikit-primary-button_next')){
		score+=15;
	}
	const label=(element.getAttribute('aria-label')||'')+element.textContent;
	const normalized=label.trim().toLowerCase();
	for(const hint of textHints){
		if(normalized.includes(hint)){
			score+=20;
			break;
		}
	}
	const rect=element.getBoundingClientRect();
	if(rect.width>0 && rect.height>0){
		score+=10;
	}
	if(element.tabIndex>=0){
		score+=5;
	}
	return score;
}

function collectButtonCandidates(){
	const seen=new Set();
	const results=[];
	for(const selector of candidateSelectors){
		const nodes=document.querySelectorAll(selector);
		for(const node of nodes){
			if(!(node instanceof HTMLElement)){
				continue;
			}
			if(seen.has(node)){
				continue;
			}
			seen.add(node);
			results.push(node);
		}
	}
	if(results.length<5){
		const fallbackButtons=document.querySelectorAll('button');
		for(const node of fallbackButtons){
			if(seen.has(node)){
				continue;
			}
			const text=(node.textContent||'').trim().toLowerCase();
			if(text && textHints.some(hint=>text.includes(hint))){
				seen.add(node);
				results.push(node);
			}
		}
	}
	return results;
}

function locateButton(){
	const candidates=collectButtonCandidates().map(element=>{
		const interactable=ensureInteractable(element);
		return {element:interactable,score:candidateScore(interactable)};
	}).filter(entry=>entry.element&&entry.score>0);
	if(!candidates.length){
		return null;
	}
	candidates.sort((a,b)=>b.score-a.score);
	return candidates[0].element;
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
