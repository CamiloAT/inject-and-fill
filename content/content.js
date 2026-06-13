(() => {
  if (window.__injectAndFillLoaded) return;
  window.__injectAndFillLoaded = true;

  let observer = null;
  let pickMode = false;
  let pickOverlay = null;
  let pickHighlight = null;
  let pickInstructions = null;

  function getFieldSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.name) return `[name="${CSS.escape(el.name)}"]`;
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) return `.${classes.map(c => CSS.escape(c)).join('.')}`;
    }
    const tag = el.tagName.toLowerCase();
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(el);
        return `${parent.tagName.toLowerCase()} > ${tag}:nth-of-type(${index + 1})`;
      }
    }
    return tag;
  }

  function getElementLabel(el) {
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return label.textContent.trim();
    }
    const parent = el.closest('label');
    if (parent) return parent.textContent.trim();

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelEl = document.getElementById(ariaLabelledBy);
      if (labelEl) return labelEl.textContent.trim();
    }

    if (el.textContent && el.textContent.trim()) {
      return el.textContent.trim().substring(0, 50);
    }

    if (el.value) return el.value;
    if (el.title) return el.title;
    if (el.alt) return el.alt;

    return '';
  }

  function simulateInput(el, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  }

  function simulateSelect(el, value) {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function simulateCheckbox(el, checked) {
    el.checked = checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('click', { bubbles: true }));
  }

  function simulateRadio(el, value) {
    if (value !== undefined && value !== '') {
      const name = el.name;
      if (name) {
        const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
        for (const radio of group) {
          if (radio.value === value) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            radio.dispatchEvent(new Event('click', { bubbles: true }));
            return;
          }
        }
      }
    }
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('click', { bubbles: true }));
  }

  function fillSingleField(field, value) {
    const el = document.querySelector(field.selector);
    if (!el) return { success: false, selector: field.selector, error: 'Elemento no encontrado' };

    const tag = el.tagName.toLowerCase();
    const type = (el.type || '').toLowerCase();

    switch (field.fieldType || type) {
      case 'select-one':
      case 'select-multiple':
        simulateSelect(el, value);
        break;
      case 'checkbox':
        simulateCheckbox(el, value === 'true' || value === true || value === '1');
        break;
      case 'radio':
        simulateRadio(el, value);
        break;
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
      case 'password':
      case 'url':
      case 'search':
      case 'date':
      case 'datetime-local':
      case 'time':
      case 'month':
      case 'week':
      case 'textarea':
        simulateInput(el, value);
        break;
      default:
        if (tag === 'select') {
          simulateSelect(el, value);
        } else if (tag === 'textarea') {
          simulateInput(el, value);
        } else if (type === 'checkbox') {
          simulateCheckbox(el, value);
        } else if (type === 'radio') {
          simulateRadio(el, value);
        } else {
          simulateInput(el, value);
        }
    }

    return { success: true, selector: field.selector };
  }

  function clickElement(field) {
    const el = document.querySelector(field.selector);
    if (!el) return { success: false, selector: field.selector, error: 'Elemento no encontrado' };
    el.click();
    return { success: true, selector: field.selector };
  }

  function detectFormFields() {
    const fields = [];
    const formElements = document.querySelectorAll(
      'input, select, textarea, [role="textbox"], [role="combobox"], [role="checkbox"], [role="radio"]'
    );

    formElements.forEach((el, index) => {
      const selector = getFieldSelector(el);
      const type = el.type || el.tagName.toLowerCase();
      const fieldType = el.tagName.toLowerCase() === 'select' ? 'select' : type;

      let options = [];
      if (el.tagName.toLowerCase() === 'select') {
        options = Array.from(el.options).map(opt => ({
          value: opt.value,
          text: opt.text,
          selected: opt.selected
        }));
      }

      const label = getElementLabel(el);

      fields.push({
        index,
        selector,
        tag: el.tagName.toLowerCase(),
        type: fieldType,
        category: 'field',
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        label,
        value: el.value || '',
        checked: el.checked || false,
        disabled: el.disabled || false,
        options,
        rect: el.getBoundingClientRect().toJSON()
      });
    });

    const buttonElements = document.querySelectorAll(
      'button, input[type="submit"], input[type="button"], [role="button"], a.btn, a.button'
    );

    buttonElements.forEach((el) => {
      const selector = getFieldSelector(el);
      const label = getElementLabel(el);
      const tag = el.tagName.toLowerCase();

      if (!label && !el.id && !el.name) return;

      fields.push({
        index: fields.length,
        selector,
        tag,
        type: 'button',
        category: 'button',
        name: el.name || '',
        id: el.id || '',
        label,
        value: el.value || el.textContent?.trim() || '',
        disabled: el.disabled || false,
        rect: el.getBoundingClientRect().toJSON()
      });
    });

    return fields;
  }

  function startPickMode() {
    if (pickMode) return;
    pickMode = true;

    pickOverlay = document.createElement('div');
    pickOverlay.id = '__iaf-pick-overlay';
    pickOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483646;background:rgba(0,0,0,0.15);cursor:crosshair;';

    pickHighlight = document.createElement('div');
    pickHighlight.id = '__iaf-pick-highlight';
    pickHighlight.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #4a9eff;background:rgba(74,158,255,0.1);border-radius:3px;transition:none;display:none;';

    pickInstructions = document.createElement('div');
    pickInstructions.id = '__iaf-pick-instructions';
    pickInstructions.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1e1e2e;padding:10px 18px;border-radius:8px;font-size:13px;font-family:system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.4);border:1px solid #3a3a4f;white-space:nowrap;text-align:center;line-height:1.6;';
    pickInstructions.innerHTML = '<div style="color:#e0e0e0;">Haz clic en un elemento. <span style="color:#888;">ESC para cancelar.</span></div><div id="__iaf-pick-status" style="color:#888;">No se ha detectado elemento</div>';

    document.documentElement.appendChild(pickOverlay);
    document.documentElement.appendChild(pickHighlight);
    document.documentElement.appendChild(pickInstructions);

    pickOverlay.addEventListener('mousemove', onPickMouseMove, true);
    pickOverlay.addEventListener('click', onPickClick, true);
    document.addEventListener('keydown', onPickKeydown, true);
    pickOverlay.addEventListener('keydown', onPickKeydown, true);
  }

  function stopPickMode() {
    if (!pickMode) return;
    pickMode = false;
    if (pickOverlay) { pickOverlay.remove(); pickOverlay = null; }
    if (pickHighlight) { pickHighlight.remove(); pickHighlight = null; }
    if (pickInstructions) { pickInstructions.remove(); pickInstructions = null; }
    document.removeEventListener('mousemove', onPickMouseMove, true);
    document.removeEventListener('click', onPickClick, true);
    document.removeEventListener('keydown', onPickKeydown, true);
  }

  function onPickMouseMove(e) {
    pickOverlay.style.pointerEvents = 'none';
    pickHighlight.style.display = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    pickOverlay.style.pointerEvents = '';

    const status = pickInstructions.querySelector('#__iaf-pick-status');
    if (!status) return;

    if (!el || el === pickOverlay || el === pickInstructions || el === document.documentElement || el === document.body) {
      pickHighlight.style.display = 'none';
      status.textContent = 'No se ha detectado elemento';
      status.style.color = '#888';
      return;
    }
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || '';
    const validTags = ['input', 'select', 'textarea', 'button'];
    const validRoles = ['textbox', 'combobox', 'checkbox', 'radio', 'button'];
    const isValid = validTags.includes(tag) || validRoles.includes(role);

    const rect = el.getBoundingClientRect();
    pickHighlight.style.display = 'block';
    pickHighlight.style.left = rect.left + 'px';
    pickHighlight.style.top = rect.top + 'px';
    pickHighlight.style.width = rect.width + 'px';
    pickHighlight.style.height = rect.height + 'px';
    pickHighlight.style.borderColor = isValid ? '#4a9eff' : '#ef5350';
    pickHighlight.style.background = isValid ? 'rgba(74,158,255,0.1)' : 'rgba(239,83,80,0.08)';

    if (isValid) {
      const label = getElementLabel(el) || el.placeholder || el.name || el.id || tag;
      const type = el.type ? `[${el.type}]` : `[${tag}]`;
      status.textContent = `${type} ${label}`;
      status.style.color = '#4caf50';
    } else {
      status.textContent = 'Elemento no valido — no es un campo de formulario';
      status.style.color = '#ef5350';
    }
  }

  function onPickClick(e) {
    e.preventDefault();
    e.stopPropagation();

    pickOverlay.style.pointerEvents = 'none';
    pickHighlight.style.display = 'none';
    pickInstructions.style.display = 'none';

    const el = document.elementFromPoint(e.clientX, e.clientY);

    pickOverlay.style.pointerEvents = '';
    pickInstructions.style.display = '';

    if (!el || el === pickOverlay || el === pickInstructions || el === document.documentElement || el === document.body) return;

    const tag = el.tagName.toLowerCase();
    const type = (el.type || '').toLowerCase();
    const validTags = ['input', 'select', 'textarea', 'button'];
    const validRoles = ['textbox', 'combobox', 'checkbox', 'radio', 'button'];
    const role = el.getAttribute('role') || '';
    if (!validTags.includes(tag) && !validRoles.includes(role)) return;

    const selector = getFieldSelector(el);
    const label = getElementLabel(el);
    const fieldType = tag === 'select' ? 'select' : tag === 'button' ? 'button' : type || tag;

    let options = [];
    if (tag === 'select') {
      options = Array.from(el.options).map(opt => ({ value: opt.value, text: opt.text }));
    }

    let radioGroup = null;
    if (type === 'radio' && el.name) {
      const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
      radioGroup = {
        name: el.name,
        radios: Array.from(group).map(r => ({
          selector: getFieldSelector(r),
          label: getElementLabel(r),
          value: r.value
        }))
      };
    }

    stopPickMode();

    try {
      chrome.runtime.sendMessage({
        action: 'elementPicked',
        data: { selector, label, tag, type: fieldType, options, radioGroup }
      });
    } catch (e) {}
  }

  function onPickKeydown(e) {
    if (e.key === 'Escape') {
      stopPickMode();
      try { chrome.runtime.sendMessage({ action: 'pickCancelled' }); } catch (e) {}
    }
  }

  async function executeSequence(actions, globalDelay) {
    const results = [];
    for (const action of actions) {
      let result;
      if (action.actionType === 'click') {
        result = clickElement(action);
      } else {
        result = fillSingleField(action, action.value);
      }
      results.push(result);
      const delay = (action.delay !== null && action.delay !== undefined && action.delay !== '') ? action.delay : globalDelay;
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return results;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'detectFields') {
      const fields = detectFormFields();
      sendResponse({ fields });
    }

    if (message.action === 'fillFields') {
      if (message.sequential) {
        executeSequence(message.fields, message.delay || 200).then(results => {
          sendResponse({ results });
        });
        return true;
      } else {
        const results = message.fields.map(field => {
          if (field.actionType === 'click') return clickElement(field);
          return fillSingleField(field, field.value);
        });
        sendResponse({ results });
      }
    }

    if (message.action === 'clickElement') {
      const el = document.querySelector(message.selector);
      if (el) {
        el.click();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Elemento no encontrado' });
      }
    }

    if (message.action === 'startAutoDetect') {
      if (observer) observer.disconnect();
      observer = new MutationObserver(() => {
        const fields = detectFormFields();
        chrome.runtime.sendMessage({ action: 'fieldsUpdated', fields });
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      sendResponse({ success: true });
    }

    if (message.action === 'stopAutoDetect') {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      sendResponse({ success: true });
    }

    if (message.action === 'startPickMode') {
      startPickMode();
      sendResponse({ success: true });
    }

    if (message.action === 'stopPickMode') {
      stopPickMode();
      sendResponse({ success: true });
    }
  });
})();
