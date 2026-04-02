// Cocos Creator Debugger - Background Script (Service Worker)

// Handle messages from DevTools panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Cocos Debugger] Background received message:', message.type, 'from:', sender.tab ? 'tab:' + sender.tab.id : sender);

    // Forward to content script in active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
            console.error('[Cocos Debugger] Tab query error:', chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
        }

        if (tabs && tabs[0]) {
            console.log('[Cocos Debugger] Sending to tab:', tabs[0].id);
            chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[Cocos Debugger] Send to tab error:', chrome.runtime.lastError.message);
                    sendResponse({ error: 'Content script not ready. Please refresh the game page.' });
                    return;
                }
                sendResponse(response);
            });
        } else {
            sendResponse({ error: 'No active tab found' });
        }
    });
    return true; // Keep channel open for async response
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('[Cocos Debugger] Extension installed');
});
