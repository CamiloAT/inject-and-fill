(() => {
  let editingProfileId = null;
  let detectedFields = [];
  let globalDelay = 200;
  let pendingPickItem = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(msg, type = '') {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.classList.add('hidden'), 2000);
  }

  function switchView(viewId) {
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#${viewId}`).classList.add('active');
  }

  // Main view
  async function renderActiveProfile() {
    const activeId = await Storage.getActiveProfile();
    const display = $('#active-profile-display');

    if (!activeId) {
      display.innerHTML = '<span class="no-profile">Ningun perfil seleccionado</span>';
      renderRecentProfiles();
      return;
    }

    const profiles = await Storage.getProfiles();
    const profile = profiles.find(p => p.id === activeId);

    if (!profile) {
      display.innerHTML = '<span class="no-profile">Ningun perfil seleccionado</span>';
      renderRecentProfiles();
      return;
    }

    const fieldCount = profile.mappings ? profile.mappings.filter(m => m.actionType !== 'click').length : 0;
    const clickCount = profile.mappings ? profile.mappings.filter(m => m.actionType === 'click').length : 0;
    let countText = '';
    if (fieldCount > 0) countText += `${fieldCount} campos`;
    if (fieldCount > 0 && clickCount > 0) countText += ' + ';
    if (clickCount > 0) countText += `${clickCount} clicks`;
    if (!countText) countText = '0 acciones';

    display.innerHTML = `
      <span class="active-badge">Activo</span>
      <div class="profile-name">${escapeHtml(profile.name)}</div>
      ${profile.description ? `<div class="profile-desc">${escapeHtml(profile.description)}</div>` : ''}
      <div class="profile-count">${countText}</div>
    `;

    renderRecentProfiles();
  }

  async function renderRecentProfiles() {
    const activeId = await Storage.getActiveProfile();
    const profiles = await Storage.getProfiles();
    const section = $('#recent-section');
    const container = $('#recent-profiles');

    const recent = profiles
      .filter(p => p.id !== activeId && p.lastUsed)
      .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
      .slice(0, 3);

    if (recent.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    container.innerHTML = recent.map(p => {
      const fieldCount = p.mappings ? p.mappings.filter(m => m.actionType !== 'click').length : 0;
      const clickCount = p.mappings ? p.mappings.filter(m => m.actionType === 'click').length : 0;
      let countText = '';
      if (fieldCount > 0) countText += `${fieldCount} campos`;
      if (fieldCount > 0 && clickCount > 0) countText += ' + ';
      if (clickCount > 0) countText += `${clickCount} clicks`;
      if (!countText) countText = '0 acciones';

      const timeAgo = getTimeAgo(p.lastUsed);

      return `
        <div class="recent-profile" data-id="${p.id}">
          <div class="recent-profile-name">${escapeHtml(p.name)}</div>
          <div class="recent-profile-count">${countText}</div>
          <div class="recent-profile-time">${timeAgo}</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.recent-profile').forEach(card => {
      card.addEventListener('click', async () => {
        await Storage.setActiveProfile(card.dataset.id);
        await updateLastUsed(card.dataset.id);
        showToast('Perfil activado', 'success');
        renderActiveProfile();
      });
    });
  }

  function getTimeAgo(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  }

  async function updateLastUsed(id) {
    await Storage.updateProfile(id, { lastUsed: new Date().toISOString() });
  }

  async function fillActiveProfile() {
    const activeId = await Storage.getActiveProfile();
    if (!activeId) {
      showToast('Selecciona un perfil primero', 'error');
      return;
    }

    const profiles = await Storage.getProfiles();
    const profile = profiles.find(p => p.id === activeId);
    if (!profile || !profile.mappings || profile.mappings.length === 0) {
      showToast('El perfil no tiene acciones mapeadas', 'error');
      return;
    }

    const settings = await Storage.getSettings();
    const fields = profile.mappings.map(m => ({
      selector: m.selector,
      value: m.value,
      fieldType: m.fieldType,
      actionType: m.actionType || 'fill',
      delay: m.delay
    }));

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'fillFields',
        fields,
        sequential: settings.sequential,
        delay: settings.fillDelay
      });

      if (response && response.results) {
        const success = response.results.filter(r => r.success).length;
        const failed = response.results.filter(r => !r.success).length;
        showToast(`Ejecutados: ${success} | Fallidos: ${failed}`, success > 0 ? 'success' : 'error');
        await updateLastUsed(activeId);
      }
    } catch (err) {
      showToast('Error al ejecutar', 'error');
    }
  }

  // Profiles view
  async function renderProfiles() {
    const profiles = await Storage.getProfiles();
    const activeId = await Storage.getActiveProfile();
    const list = $('#profiles-list');

    if (profiles.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-dim);">No hay perfiles creados</div>';
      return;
    }

    list.innerHTML = profiles.map(p => `
      <div class="profile-card ${p.id === activeId ? 'active' : ''}" data-id="${p.id}">
        <div class="profile-card-info">
          <div class="profile-card-name">${escapeHtml(p.name)}</div>
          <div class="profile-card-meta">${p.mappings ? p.mappings.length : 0} acciones ${p.id === activeId ? '· Activo' : ''}</div>
        </div>
        <div class="profile-card-actions">
          <button class="icon-btn edit-profile-btn" data-id="${p.id}" title="Editar">&#9998;</button>
          <button class="icon-btn delete-profile-btn" data-id="${p.id}" title="Eliminar" style="color:var(--danger)">&#10005;</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.profile-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.edit-profile-btn') || e.target.closest('.delete-profile-btn')) return;
        await Storage.setActiveProfile(card.dataset.id);
        await updateLastUsed(card.dataset.id);
        showToast('Perfil activado', 'success');
        renderProfiles();
        renderActiveProfile();
      });
    });

    list.querySelectorAll('.edit-profile-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const profile = profiles.find(p => p.id === btn.dataset.id);
        if (profile) openEditProfile(profile);
      });
    });

    list.querySelectorAll('.delete-profile-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await Storage.deleteProfile(btn.dataset.id);
        showToast('Eliminado', 'success');
        renderProfiles();
        renderActiveProfile();
      });
    });
  }

  // Edit profile view
  async function openEditProfile(profile) {
    editingProfileId = profile ? profile.id : null;
    $('#edit-title').textContent = profile ? 'Editar Perfil' : 'Nuevo Perfil';
    $('#profile-name').value = profile ? profile.name : '';
    $('#profile-desc').value = profile ? (profile.description || '') : '';

    const list = $('#mappings-list');
    if (profile && profile.mappings && profile.mappings.length > 0) {
      list.innerHTML = profile.mappings.map((m, i) =>
        createMappingHtml(i + 1, m.selector, m.value, m.fieldType, m.actionType, m.delay)
      ).join('');
    } else {
      list.innerHTML = '';
    }

    switchView('view-edit-profile');

    // Auto-scan to populate detectedFields so dropdowns work
    try {
      const response = await chrome.runtime.sendMessage({ action: 'detectFields' });
      if (response && response.fields && response.fields.length > 0) {
        detectedFields = response.fields;
        $('#scan-hint').style.display = 'none';

        // Rebuild dropdowns with detected fields and try to match saved selectors
        list.querySelectorAll('.mapping-item').forEach((item, i) => {
          const sel = item.querySelector('.mapping-field-select');
          const savedSelector = profile && profile.mappings && profile.mappings[i] ? profile.mappings[i].selector : '';
          const savedValue = profile && profile.mappings && profile.mappings[i] ? profile.mappings[i].value : '';
          const savedActionType = profile && profile.mappings && profile.mappings[i] ? profile.mappings[i].actionType : '';

          setCustomSelectValue(sel, buildFieldOptions(), '');

          if (savedSelector) {
            if (savedSelector.startsWith('radiogroup:')) {
              setCustomSelectValue(sel, buildFieldOptions(), savedSelector);
              renderValueInput(item, savedSelector, savedValue);
            } else {
              const matchIdx = detectedFields.findIndex(f => f.selector === savedSelector);
              if (matchIdx !== -1) {
                setCustomSelectValue(sel, buildFieldOptions(), matchIdx.toString());
                renderValueInput(item, matchIdx.toString(), savedValue);
              }
            }
          }
        });
      }
    } catch (e) {}
  }

  function getFieldLabel(f) {
    return f.label || f.name || f.placeholder || f.selector;
  }

  function getFieldType(f) {
    if (f.category === 'button') return 'button';
    if (f.tag === 'select') return 'select';
    if (f.type === 'checkbox') return 'checkbox';
    if (f.type === 'radio') return 'radio';
    return 'text';
  }

  function getItemLabelHtml(f) {
    const label = getFieldLabel(f);
    const type = getFieldType(f);
    if (type === 'button') return `<b>[BOTON]</b> ${escapeHtml(label)}`;
    if (type === 'select') {
      const current = f.options ? f.options.find(o => o.selected) : null;
      const suffix = current ? ` → <i>"${escapeHtml(current.text)}"</i>` : '';
      return `<b>[SELECT]</b> ${escapeHtml(label)}${suffix}`;
    }
    if (type === 'checkbox') {
      const suffix = f.checked ? ' ✓' : '';
      return `<b>[CHECK]</b> ${escapeHtml(label)}${suffix}`;
    }
    if (type === 'radio') return `<b>[RADIO]</b> ${escapeHtml(label)} <i>"${escapeHtml(f.value)}"</i>`;
    const val = f.value || '';
    const suffix = val ? ` = <i>"${escapeHtml(val)}"</i>` : '';
    return `<b>[INPUT]</b> ${escapeHtml(label)}${suffix}`;
  }

  function getItemLabel(f) {
    const label = getFieldLabel(f);
    const type = getFieldType(f);
    if (type === 'button') return `[BOTON] ${label}`;
    if (type === 'select') {
      const current = f.options ? f.options.find(o => o.selected) : null;
      const suffix = current ? ` → "${current.text}"` : '';
      return `[SELECT] ${label}${suffix}`;
    }
    if (type === 'checkbox') {
      const suffix = f.checked ? ' ✓' : '';
      return `[CHECK] ${label}${suffix}`;
    }
    if (type === 'radio') return `[RADIO] ${label} "${f.value}"`;
    const val = f.value || '';
    const suffix = val ? ` = "${val}"` : '';
    return `[INPUT] ${label}${suffix}`;
  }

  let radioGroups = {};

  function buildFieldOptions() {
    radioGroups = {};
    const seen = new Set();
    let options = '';

    detectedFields.forEach((f, i) => {
      if (f.type === 'radio' && f.name) {
        if (seen.has(f.name)) return;
        seen.add(f.name);

        const groupRadios = detectedFields.filter(r => r.type === 'radio' && r.name === f.name);
        radioGroups[f.name] = groupRadios;

        const label = f.name || getFieldLabel(f);
        const values = groupRadios.map(r => r.value).join(', ');
        const html = `<b>[RADIO]</b> ${escapeHtml(label)} <i>(${escapeHtml(values)})</i>`;
        options += `<div class="custom-option" data-value="radiogroup:${escapeHtml(f.name)}">${html}</div>`;
      } else if (f.type !== 'radio') {
        const html = getItemLabelHtml(f);
        options += `<div class="custom-option" data-value="${i}">${html}</div>`;
      }
    });

    return options;
  }

  function createCustomSelectHtml(id, options, selectedValue, cssClass) {
    const classAttr = cssClass ? ` ${cssClass}` : '';
    let triggerHtml = '<span class="custom-select-placeholder">-- Seleccionar --</span>';
    const match = options.find(o => o.value === selectedValue);
    if (match) triggerHtml = match.html || escapeHtml(match.label || match.value);

    return `
      <div class="custom-select${classAttr}" data-id="${id || ''}" data-value="${escapeHtml(selectedValue || '')}">
        <div class="custom-select-trigger${match ? ' has-value' : ''}">${triggerHtml}</div>
        <div class="custom-select-options">
          ${options.map(o => `<div class="custom-option" data-value="${escapeHtml(o.value)}">${o.html || escapeHtml(o.label || o.value)}</div>`).join('')}
        </div>
      </div>
    `;
  }

  function setCustomSelectById(container, value) {
    const sel = container.querySelector('.custom-select');
    if (!sel) return;
    sel.dataset.value = value || '';
    const trigger = sel.querySelector('.custom-select-trigger');
    const match = sel.querySelector(`.custom-option[data-value="${CSS.escape(String(value || ''))}"]`);
    if (match) {
      trigger.innerHTML = match.innerHTML;
      trigger.classList.add('has-value');
    } else {
      trigger.textContent = '-- Seleccionar --';
      trigger.classList.remove('has-value');
    }
  }

  function setCustomSelectValue(sel, optionsHtml, value) {
    sel.dataset.value = value || '';
    const trigger = sel.querySelector('.custom-select-trigger');
    const optionsContainer = sel.querySelector('.custom-select-options');
    optionsContainer.innerHTML = optionsHtml;
    if (!value && value !== 0) {
      trigger.textContent = '-- Seleccionar campo o boton --';
      trigger.classList.remove('has-value');
    } else {
      const match = optionsContainer.querySelector(`.custom-option[data-value="${CSS.escape(String(value))}"]`);
      if (match) {
        trigger.innerHTML = match.innerHTML;
        trigger.classList.add('has-value');
      }
    }
  }

  function createMappingHtml(num, savedSelector, savedValue, savedType, savedActionType, savedDelay) {
    const delayVal = savedDelay !== undefined && savedDelay !== null && savedDelay !== '' ? savedDelay : globalDelay;
    return `
      <div class="mapping-item" data-saved-selector="${escapeHtml(savedSelector || '')}" data-saved-value="${escapeHtml(savedValue || '')}" data-saved-action-type="${escapeHtml(savedActionType || '')}">
        <div class="mapping-header">
          <div class="mapping-header-left">
            <span class="mapping-drag-handle" title="Arrastrar para reordenar">&#9776;</span>
            <span class="mapping-num">Accion ${num}</span>
          </div>
          <div class="mapping-header-right">
            <button class="icon-btn move-up-btn" title="Mover arriba">&#9650;</button>
            <button class="icon-btn move-down-btn" title="Mover abajo">&#9660;</button>
            <button class="icon-btn remove-mapping-btn" style="color:var(--danger);font-size:12px;">&#10005;</button>
          </div>
        </div>
        <div class="mapping-row">
          <div class="custom-select mapping-field-select" data-value="">
            <div class="custom-select-trigger"><span class="custom-select-placeholder">-- Seleccionar campo o boton --</span></div>
            <div class="custom-select-options">
              ${buildFieldOptions()}
            </div>
          </div>
          <button class="icon-btn pick-from-page-btn" title="Elegir de la pagina">&#8853;</button>
        </div>
        <div class="mapping-value-container"></div>
        <div class="mapping-row mapping-delay-row">
          <label class="mapping-delay-label">Retraso (ms)</label>
          <input type="number" class="input mapping-delay" value="${escapeHtml(String(delayVal))}" min="0" max="30000">
          <span class="mapping-spacer"></span>
        </div>
      </div>
    `;
  }

  function renderValueInput(mappingItem, fieldIndex, savedValue) {
    const container = mappingItem.querySelector('.mapping-value-container');
    if (fieldIndex === '' || fieldIndex === undefined) {
      container.innerHTML = '';
      return;
    }

    if (typeof fieldIndex === 'string' && fieldIndex.startsWith('radiogroup:')) {
      const radioName = fieldIndex.replace('radiogroup:', '');
      const group = radioGroups[radioName] || [];
      if (group.length > 0) {
        const options = group.map(r => ({
          value: r.value,
          html: `${escapeHtml(getFieldLabel(r))} <i>(${escapeHtml(r.value)})</i>`
        }));
        container.innerHTML = `
          <div class="mapping-row">
            ${createCustomSelectHtml('radio-value', options, savedValue, 'mapping-value mapping-value-radio')}
            <span class="mapping-spacer"></span>
          </div>
        `;
      }
      mappingItem.dataset.savedActionType = 'fill';
      mappingItem.dataset.savedRadioName = radioName;
      return;
    }

    const field = detectedFields[fieldIndex];
    if (!field) {
      container.innerHTML = '';
      return;
    }

    const type = getFieldType(field);

    if (type === 'button') {
      container.innerHTML = `
        <div class="mapping-row">
          <span class="click-hint">Hara click en este elemento</span>
          <span class="mapping-spacer"></span>
        </div>
      `;
      mappingItem.dataset.savedActionType = 'click';
    } else if (type === 'select' && field.options && field.options.length > 0) {
      const options = field.options.map(opt => ({
        value: opt.value,
        html: opt.value === '' || opt.text === opt.value
          ? `<i style="color:var(--text-dim)">${escapeHtml(opt.text)}</i>`
          : escapeHtml(opt.text)
      }));
      const selVal = savedValue || field.value || '';
      container.innerHTML = `
        <div class="mapping-row">
          ${createCustomSelectHtml('select-value', options, selVal, 'mapping-value mapping-value-select')}
          <span class="mapping-spacer"></span>
        </div>
      `;
      mappingItem.dataset.savedActionType = 'fill';
    } else if (type === 'checkbox') {
      const options = [
        { value: 'true', html: 'Marcar <span style="color:var(--success)">✓</span>' },
        { value: 'false', html: 'No marcar <span style="color:var(--danger)">✗</span>' }
      ];
      container.innerHTML = `
        <div class="mapping-row">
          ${createCustomSelectHtml('check-value', options, savedValue || 'true', 'mapping-value mapping-value-check')}
          <span class="mapping-spacer"></span>
        </div>
      `;
      mappingItem.dataset.savedActionType = 'fill';
    } else {
      container.innerHTML = `
        <div class="mapping-row">
          <input type="text" class="input mapping-value mapping-value-text" value="${escapeHtml(savedValue || '')}" placeholder="Valor a rellenar">
          <span class="mapping-spacer"></span>
        </div>
      `;
      mappingItem.dataset.savedActionType = 'fill';
    }
  }

  async function scanFields() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'detectFields' });
      if (response && response.fields && response.fields.length > 0) {
        detectedFields = response.fields;
        $('#scan-hint').style.display = 'none';

        const list = $('#mappings-list');
        if (list.children.length === 0) {
          list.innerHTML = createMappingHtml(1, '', '', 'text', '', null);
          const item = list.querySelector('.mapping-item');
          renderValueInput(item, '', '');
        } else {
          list.querySelectorAll('.mapping-item').forEach(item => {
            const sel = item.querySelector('.mapping-field-select');
            const savedSelector = item.dataset.savedSelector || '';
            const savedValue = item.dataset.savedValue || '';

            setCustomSelectValue(sel, buildFieldOptions(), '');

            if (savedSelector) {
              if (savedSelector.startsWith('radiogroup:')) {
                setCustomSelectValue(sel, buildFieldOptions(), savedSelector);
                renderValueInput(item, savedSelector, savedValue);
              } else {
                const matchIdx = detectedFields.findIndex(f => f.selector === savedSelector);
                if (matchIdx !== -1) {
                  setCustomSelectValue(sel, buildFieldOptions(), matchIdx.toString());
                  renderValueInput(item, matchIdx.toString(), savedValue);
                }
              }
            }
          });
        }

        showToast(`${detectedFields.length} elementos detectados`, 'success');
      } else {
        const hint = response && response.error ? response.error : '';
        if (hint.includes('Cannot access') || hint.includes('file://')) {
          showToast('Ve a chrome://extensions > Detalles > activa "Allow access to file URLs"', 'error');
        } else {
          showToast('No se detectaron elementos', 'error');
        }
      }
    } catch (err) {
      showToast('Error: ' + (err.message || err), 'error');
    }
  }

  async function saveProfile() {
    const name = $('#profile-name').value.trim();
    if (!name) {
      showToast('Ingresa un nombre', 'error');
      return;
    }

    const mappings = [];
    $$('#mappings-list .mapping-item').forEach(item => {
      const fieldIndex = item.querySelector('.mapping-field-select').dataset.value || '';
      const valueSelect = item.querySelector('.mapping-value-container .custom-select');
      const valueInput = item.querySelector('.mapping-value-container .mapping-value-text');
      const value = valueSelect ? (valueSelect.dataset.value || '').trim() : (valueInput ? (valueInput.value || '').trim() : '');
      const savedSelector = item.dataset.savedSelector || '';
      const delayEl = item.querySelector('.mapping-delay');
      const delay = delayEl && delayEl.value !== '' ? parseInt(delayEl.value) : null;

      if (fieldIndex.startsWith('radiogroup:')) {
        const radioName = fieldIndex.replace('radiogroup:', '');
        const radio = detectedFields.find(f => f.type === 'radio' && f.name === radioName && f.value === value);
        if (radio) {
          mappings.push({
            selector: radio.selector,
            value: radio.value,
            fieldType: 'radio',
            actionType: 'fill',
            delay
          });
        }
      } else if (fieldIndex !== '' && detectedFields[fieldIndex]) {
        const field = detectedFields[fieldIndex];
        mappings.push({
          selector: field.selector,
          value,
          fieldType: getFieldType(field),
          actionType: getFieldType(field) === 'button' ? 'click' : 'fill',
          delay
        });
      } else if (savedSelector) {
        mappings.push({
          selector: savedSelector,
          value: item.dataset.savedValue || value,
          fieldType: 'text',
          actionType: item.dataset.savedActionType || 'fill',
          delay
        });
      }
    });

    if (mappings.length === 0) {
      showToast('Agrega al menos una accion', 'error');
      return;
    }

    if (editingProfileId) {
      await Storage.updateProfile(editingProfileId, {
        name,
        description: $('#profile-desc').value.trim(),
        mappings
      });
    } else {
      const profile = await Storage.addProfile({
        name,
        description: $('#profile-desc').value.trim(),
        mappings,
        lastUsed: new Date().toISOString()
      });
      await Storage.setActiveProfile(profile.id);
    }

    showToast('Perfil guardado', 'success');
    renderActiveProfile();
    renderProfiles();
    switchView('view-profiles');
  }

  // Settings
  async function loadSettings() {
    const settings = await Storage.getSettings();
    globalDelay = settings.fillDelay;
    $('#setting-delay').value = settings.fillDelay;
    $('#setting-sequential').checked = settings.sequential;
  }

  async function saveSettings() {
    globalDelay = parseInt($('#setting-delay').value) || 200;
    await Storage.saveSettings({
      fillDelay: globalDelay,
      sequential: $('#setting-sequential').checked
    });
  }

  function renumberMappings() {
    $$('#mappings-list .mapping-item').forEach((item, i) => {
      const num = item.querySelector('.mapping-num');
      if (num) num.textContent = `Accion ${i + 1}`;
    });
  }

  function moveMapping(item, direction) {
    const list = $('#mappings-list');
    const items = Array.from(list.querySelectorAll('.mapping-item'));
    const idx = items.indexOf(item);
    if (direction === 'up' && idx > 0) {
      list.insertBefore(item, items[idx - 1]);
    } else if (direction === 'down' && idx < items.length - 1) {
      list.insertBefore(items[idx + 1], item);
    }
    renumberMappings();
  }

  function init() {
    renderActiveProfile();
    loadSettings();

    // Listen for pick mode results from content script
    chrome.runtime.onMessage.addListener((message) => {
      try {
        if (message.action === 'elementPicked' && message.data) {
        const data = message.data;
        const item = pendingPickItem;
        if (!item) return;

        if (data.radioGroup) {
          const group = data.radioGroup;
          group.radios.forEach(r => {
            detectedFields.push({
              index: detectedFields.length,
              selector: r.selector,
              tag: 'input',
              type: 'radio',
              category: 'field',
              name: group.name,
              id: '',
              placeholder: '',
              label: r.label,
              value: r.value,
              checked: false,
              disabled: false,
              options: []
            });
          });

          const sel = item.querySelector('.mapping-field-select');
          const values = group.radios.map(r => r.value).join(', ');
          const html = `<b>[RADIO]</b> ${escapeHtml(group.name)} <i>(${escapeHtml(values)})</i>`;
          sel.innerHTML = `
            <div class="custom-select-trigger has-value">${html}</div>
            <div class="custom-select-options">${buildFieldOptions()}</div>
          `;
          sel.dataset.value = `radiogroup:${group.name}`;
          item.dataset.savedSelector = `radiogroup:${group.name}`;

          renderValueInput(item, `radiogroup:${group.name}`, '');
        } else {
          const pickedField = {
            index: detectedFields.length,
            selector: data.selector,
            tag: data.tag,
            type: data.type,
            category: data.type === 'button' ? 'button' : 'field',
            name: '',
            id: '',
            placeholder: '',
            label: data.label,
            value: '',
            checked: false,
            disabled: false,
            options: data.options || []
          };
          detectedFields.push(pickedField);
          const newIndex = detectedFields.length - 1;

          const sel = item.querySelector('.mapping-field-select');
          const optionHtml = getItemLabelHtml(pickedField);
          sel.innerHTML = `
            <div class="custom-select-trigger has-value">${optionHtml}</div>
            <div class="custom-select-options">${buildFieldOptions()}</div>
          `;
          sel.dataset.value = String(newIndex);
          item.dataset.savedSelector = data.selector;

          renderValueInput(item, String(newIndex), '');
        }

        pendingPickItem = null;
        showToast('Elemento seleccionado', 'success');
      }
      if (message.action === 'pickCancelled') {
        pendingPickItem = null;
        showToast('Selector cancelado', 'success');
      }
      } catch (e) {}
    });

    // Main view
    $('#btn-fill').addEventListener('click', fillActiveProfile);
    $('#btn-reload').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'reloadTab', bypassCache: false });
      showToast('Recargando...', 'success');
    });
    $('#btn-reload-nocache').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'reloadTab', bypassCache: true });
      showToast('Recargando sin cache...', 'success');
    });
    $('#btn-settings').addEventListener('click', () => switchView('view-settings'));
    $('#active-profile-display').addEventListener('click', () => {
      renderProfiles();
      switchView('view-profiles');
    });
    $('#btn-manage-profiles').addEventListener('click', () => {
      renderProfiles();
      switchView('view-profiles');
    });

    // Profiles view
    $('#btn-back-profiles').addEventListener('click', () => {
      renderActiveProfile();
      switchView('view-main');
    });
    $('#btn-new-profile').addEventListener('click', () => openEditProfile(null));

    // Edit profile view
    $('#btn-back-edit').addEventListener('click', () => switchView('view-profiles'));
    $('#btn-save-profile').addEventListener('click', saveProfile);
    $('#btn-scan-fields').addEventListener('click', scanFields);
    $('#btn-add-mapping').addEventListener('click', () => {
      const list = $('#mappings-list');
      const count = list.querySelectorAll('.mapping-item').length + 1;
      const html = createMappingHtml(count, '', '', 'text', '', null);
      list.insertAdjacentHTML('beforeend', html);
      const newItem = list.lastElementChild;
      renderValueInput(newItem, '', '');
    });

    // Delegated events on mappings-list
    $('#mappings-list').addEventListener('click', (e) => {
      const pickBtn = e.target.closest('.pick-from-page-btn');
      if (pickBtn) {
        pickBtn.blur();
        pendingPickItem = pickBtn.closest('.mapping-item');
        chrome.runtime.sendMessage({ action: 'startPickMode' }, (response) => {
          if (response && response.success) {
            showToast('Toca un elemento en la pagina. ESC para cancelar.', 'success');
          } else {
            showToast('No se pudo activar el selector', 'error');
            pendingPickItem = null;
          }
        });
        return;
      }

      const removeBtn = e.target.closest('.remove-mapping-btn');
      if (removeBtn) {
        removeBtn.closest('.mapping-item').remove();
        renumberMappings();
        return;
      }
      const upBtn = e.target.closest('.move-up-btn');
      if (upBtn) {
        moveMapping(upBtn.closest('.mapping-item'), 'up');
        return;
      }
      const downBtn = e.target.closest('.move-down-btn');
      if (downBtn) {
        moveMapping(downBtn.closest('.mapping-item'), 'down');
        return;
      }

      // Custom select trigger
      const trigger = e.target.closest('.custom-select-trigger');
      if (trigger) {
        const sel = trigger.closest('.custom-select');
        const wasOpen = sel.classList.contains('open');
        $$('.custom-select.open').forEach(s => s.classList.remove('open'));
        if (!wasOpen) sel.classList.add('open');
        return;
      }

      // Custom select option
      const option = e.target.closest('.custom-option');
      if (option) {
        const sel = option.closest('.custom-select');
        const mappingItem = sel.closest('.mapping-item');
        const value = option.dataset.value;
        sel.dataset.value = value;
        sel.querySelector('.custom-select-trigger').innerHTML = option.innerHTML;
        sel.querySelector('.custom-select-trigger').classList.add('has-value');
        sel.classList.remove('open');

        // Field selector
        if (sel.classList.contains('mapping-field-select')) {
          if (value.startsWith('radiogroup:')) {
            mappingItem.dataset.savedSelector = value;
          } else if (value !== '' && detectedFields[value]) {
            mappingItem.dataset.savedSelector = detectedFields[value].selector;
          } else {
            mappingItem.dataset.savedSelector = '';
          }
          renderValueInput(mappingItem, value, '');
        } else {
          // Value selector (radio, select, check)
          mappingItem.dataset.savedValue = value;
        }
        return;
      }

      // Close open selects when clicking outside
      if (!e.target.closest('.custom-select')) {
        $$('.custom-select.open').forEach(s => s.classList.remove('open'));
      }
    });

    // Drag and drop reorder (only from handle)
    let draggedItem = null;
    $('#mappings-list').addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.mapping-drag-handle');
      if (handle) {
        handle.closest('.mapping-item').setAttribute('draggable', 'true');
      }
    });
    $('#mappings-list').addEventListener('dragstart', (e) => {
      const handle = e.target.closest('.mapping-drag-handle');
      draggedItem = handle ? handle.closest('.mapping-item') : e.target.closest('.mapping-item');
      if (draggedItem) {
        draggedItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      }
    });
    $('#mappings-list').addEventListener('dragend', (e) => {
      if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem.removeAttribute('draggable');
      }
      draggedItem = null;
      $$('.mapping-item').forEach(el => el.classList.remove('drag-over'));
    });
    $('#mappings-list').addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('.mapping-item');
      if (target && target !== draggedItem) {
        $$('.mapping-item').forEach(el => el.classList.remove('drag-over'));
        target.classList.add('drag-over');
      }
    });
    $('#mappings-list').addEventListener('drop', (e) => {
      e.preventDefault();
      const target = e.target.closest('.mapping-item');
      if (target && target !== draggedItem && draggedItem) {
        const list = $('#mappings-list');
        const items = Array.from(list.querySelectorAll('.mapping-item'));
        const dragIdx = items.indexOf(draggedItem);
        const dropIdx = items.indexOf(target);
        if (dragIdx < dropIdx) {
          list.insertBefore(draggedItem, target.nextSibling);
        } else {
          list.insertBefore(draggedItem, target);
        }
        renumberMappings();
      }
      $$('.mapping-item').forEach(el => el.classList.remove('drag-over'));
    });

    // Settings view
    $('#btn-back-settings').addEventListener('click', () => {
      saveSettings();
      switchView('view-main');
    });
    $('#setting-delay').addEventListener('change', saveSettings);
    $('#setting-sequential').addEventListener('change', saveSettings);

    // Global ESC to cancel pick mode from side panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && pendingPickItem) {
        pendingPickItem = null;
        try { chrome.runtime.sendMessage({ action: 'stopPickMode' }); } catch (err) {}
        showToast('Selector cancelado', 'success');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
