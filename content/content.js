(() => {
  let observer = null;

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

  function simulateRadio(el) {
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
        simulateRadio(el);
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
          simulateRadio(el);
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

  async function executeSequence(actions, delay) {
    const results = [];
    for (const action of actions) {
      let result;
      if (action.actionType === 'click') {
        result = clickElement(action);
      } else {
        result = fillSingleField(action, action.value);
      }
      results.push(result);
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
  });
})();
