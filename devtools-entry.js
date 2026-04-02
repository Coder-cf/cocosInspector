// DevTools entry point - creates the panel
console.log('[Cocos Debugger] Entry script loading...');

if (chrome.devtools && chrome.devtools.panels) {
    console.log('[Cocos Debugger] chrome.devtools.panels available');
    chrome.devtools.panels.create(
        'Cocos Debugger',     // title shown in DevTools tab
        '',                   // icon (optional)
        'devtools.html',      // panel content page
        (panel) => {
            console.log('[Cocos Debugger] Panel created callback, panel:', panel);
            if (chrome.runtime.lastError) {
                console.error('[Cocos Debugger] Runtime error:', chrome.runtime.lastError.message);
            }
        }
    );
} else {
    console.error('[Cocos Debugger] chrome.devtools.panels not available');
}
