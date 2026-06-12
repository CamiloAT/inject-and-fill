chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'reloadTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id, { bypassCache: message.bypassCache || false });
      }
    });
    sendResponse({ success: true });
  }

  if (message.action === 'navigateTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.update(tabs[0].id, { url: message.url });
      }
    });
    sendResponse({ success: true });
  }

  if (message.action === 'clickElement') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'clickElement',
          selector: message.selector
        }, sendResponse);
      }
    });
    return true;
  }

  if (message.action === 'fillFields') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fillFields',
          fields: message.fields,
          sequential: message.sequential || false,
          delay: message.delay || 200
        }, sendResponse);
      }
    });
    return true;
  }

  if (message.action === 'detectFields') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'detectFields'
        }, sendResponse);
      }
    });
    return true;
  }
});
