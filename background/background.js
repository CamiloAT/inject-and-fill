chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'reloadTab') {
    getActiveTab().then((tab) => {
      if (tab) chrome.tabs.reload(tab.id, { bypassCache: message.bypassCache || false });
    });
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'navigateTab') {
    getActiveTab().then((tab) => {
      if (tab) chrome.tabs.update(tab.id, { url: message.url });
    });
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'detectFields') {
    getActiveTab().then(async (tab) => {
      if (!tab) { sendResponse({ fields: [], error: 'No active tab' }); return; }
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: function() {
            function getFieldSelector(el) {
              if (el.id) return '#' + CSS.escape(el.id);
              if (el.name) return '[name="' + CSS.escape(el.name) + '"]';
              if (el.className && typeof el.className === 'string') {
                var classes = el.className.trim().split(/\s+/).filter(Boolean);
                if (classes.length > 0) return '.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
              }
              var tag = el.tagName.toLowerCase();
              var parent = el.parentElement;
              if (parent) {
                var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === el.tagName; });
                if (siblings.length > 1) {
                  var index = siblings.indexOf(el);
                  return parent.tagName.toLowerCase() + ' > ' + tag + ':nth-of-type(' + (index + 1) + ')';
                }
              }
              return tag;
            }
            function getElementLabel(el) {
              if (el.id) {
                var label = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
                if (label) return label.textContent.trim();
              }
              var p = el.closest('label');
              if (p) return p.textContent.trim();
              if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
              if (el.textContent && el.textContent.trim()) return el.textContent.trim().substring(0, 50);
              if (el.value) return el.value;
              if (el.title) return el.title;
              return '';
            }
            var fields = [];
            document.querySelectorAll('input, select, textarea, [role="textbox"], [role="combobox"], [role="checkbox"], [role="radio"]').forEach(function(el, i) {
              var selector = getFieldSelector(el);
              var type = el.type || el.tagName.toLowerCase();
              var fieldType = el.tagName.toLowerCase() === 'select' ? 'select' : type;
              var options = [];
              if (el.tagName.toLowerCase() === 'select') {
                options = Array.from(el.options).map(function(o) { return { value: o.value, text: o.text, selected: o.selected }; });
              }
              fields.push({ index: i, selector: selector, tag: el.tagName.toLowerCase(), type: fieldType, category: 'field', name: el.name || '', id: el.id || '', placeholder: el.placeholder || '', label: getElementLabel(el), value: el.value || '', checked: el.checked || false, disabled: el.disabled || false, options: options, rect: el.getBoundingClientRect().toJSON() });
            });
            document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]').forEach(function(el) {
              var selector = getFieldSelector(el);
              var label = getElementLabel(el);
              if (!label && !el.id && !el.name) return;
              fields.push({ index: fields.length, selector: selector, tag: el.tagName.toLowerCase(), type: 'button', category: 'button', name: el.name || '', id: el.id || '', label: label, value: el.value || (el.textContent ? el.textContent.trim() : ''), disabled: el.disabled || false, rect: el.getBoundingClientRect().toJSON() });
            });
            return fields;
          }
        });
        const fields = (results && results[0] && results[0].result) ? results[0].result : [];
        sendResponse({ fields });
      } catch (e) {
        sendResponse({ fields: [], error: e.message || String(e) });
      }
    });
    return true;
  }

  if (message.action === 'fillFields') {
    getActiveTab().then(async (tab) => {
      if (!tab) { sendResponse({ results: [] }); return; }
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
      } catch (e) {}
      const response = await sendToTab(tab.id, {
        action: 'fillFields',
        fields: message.fields,
        sequential: message.sequential || false,
        delay: message.delay || 200
      });
      sendResponse(response || { results: [] });
    });
    return true;
  }

  if (message.action === 'clickElement') {
    getActiveTab().then(async (tab) => {
      if (!tab) { sendResponse({ success: false }); return; }
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
      } catch (e) {}
      const response = await sendToTab(tab.id, { action: 'clickElement', selector: message.selector });
      sendResponse(response || { success: false });
    });
    return true;
  }

  if (message.action === 'startPickMode') {
    getActiveTab().then(async (tab) => {
      if (!tab) { sendResponse({ success: false, error: 'No active tab' }); return; }
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
      } catch (e) {}
      const response = await sendToTab(tab.id, { action: 'startPickMode' });
      sendResponse(response || { success: false });
    });
    return true;
  }

  return false;
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'elementPicked' || message.action === 'pickCancelled') {
    try { chrome.runtime.sendMessage(message); } catch (e) {}
  }
});
