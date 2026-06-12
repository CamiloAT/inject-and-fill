(() => {
  let editingProfileId = null;
  let detectedFields = [];

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
      return;
    }

    const profiles = await Storage.getProfiles();
    const profile = profiles.find(p => p.id === activeId);

    if (!profile) {
      display.innerHTML = '<span class="no-profile">Ningun perfil seleccionado</span>';
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
      <div class="profile-name">${escapeHtml(profile.name)}</div>
      ${profile.description ? `<div class="profile-desc">${escapeHtml(profile.description)}</div>` : ''}
      <div class="profile-count">${countText}</div>
    `;
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
      actionType: m.actionType || 'fill'
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
        createMappingHtml(i + 1, m.selector, m.value, m.fieldType, m.actionType)
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

          sel.innerHTML = '<option value="">-- Seleccionar campo o boton --</option>' + buildFieldOptions();

          if (savedSelector) {
            if (savedSelector.startsWith('radiogroup:')) {
              sel.value = savedSelector;
              renderValueInput(item, savedSelector, savedValue);
            } else {
              const matchIdx = detectedFields.findIndex(f => f.selector === savedSelector);
              if (matchIdx !== -1) {
                sel.value = matchIdx.toString();
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

  function getItemLabel(f) {
    const label = getFieldLabel(f);
    const type = getFieldType(f);
    if (type === 'button') return `[Click] ${label}`;
    return `${label} (${type})`;
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
        options += `<option value="radiogroup:${escapeHtml(f.name)}">${escapeHtml(label)} (radio ${groupRadios.length} opciones)</option>`;
      } else if (f.type !== 'radio') {
        options += `<option value="${i}">${escapeHtml(getItemLabel(f))}</option>`;
      }
    });

    return options;
  }

  function createMappingHtml(num, savedSelector, savedValue, savedType, savedActionType) {
    return `
      <div class="mapping-item" data-saved-selector="${escapeHtml(savedSelector || '')}" data-saved-value="${escapeHtml(savedValue || '')}" data-saved-action-type="${escapeHtml(savedActionType || '')}">
        <div class="mapping-header">
          <span class="mapping-num">Accion ${num}</span>
          <button class="icon-btn remove-mapping-btn" style="color:var(--danger);font-size:12px;">&#10005;</button>
        </div>
        <div class="mapping-row">
          <select class="mapping-field-select">
            <option value="">-- Seleccionar campo o boton --</option>
            ${buildFieldOptions()}
          </select>
        </div>
        <div class="mapping-value-container"></div>
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
        container.innerHTML = `
          <div class="mapping-row">
            <select class="mapping-value mapping-value-radio">
              ${group.map(r => {
                const label = getFieldLabel(r);
                const selected = (r.value === savedValue) ? 'selected' : '';
                return `<option value="${escapeHtml(r.value)}" ${selected}>${escapeHtml(label)} (${r.value})</option>`;
              }).join('')}
            </select>
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
        </div>
      `;
      mappingItem.dataset.savedActionType = 'click';
    } else if (type === 'select' && field.options && field.options.length > 0) {
      container.innerHTML = `
        <div class="mapping-row">
          <select class="mapping-value mapping-value-select">
            ${field.options.map(opt => {
              const selected = (opt.value === savedValue || opt.text === savedValue) ? 'selected' : '';
              return `<option value="${escapeHtml(opt.value)}" ${selected}>${escapeHtml(opt.text)}</option>`;
            }).join('')}
          </select>
        </div>
      `;
      mappingItem.dataset.savedActionType = 'fill';
    } else if (type === 'checkbox') {
      container.innerHTML = `
        <div class="mapping-row">
          <select class="mapping-value mapping-value-check">
            <option value="true" ${savedValue === 'true' ? 'selected' : ''}>Marcar (checked)</option>
            <option value="false" ${savedValue === 'false' ? 'selected' : ''}>Desmarcar (unchecked)</option>
          </select>
        </div>
      `;
      mappingItem.dataset.savedActionType = 'fill';
    } else {
      container.innerHTML = `
        <div class="mapping-row">
          <input type="text" class="input mapping-value mapping-value-text" value="${escapeHtml(savedValue || '')}" placeholder="Valor a rellenar">
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
          list.innerHTML = createMappingHtml(1, '', '', 'text', '');
          const item = list.querySelector('.mapping-item');
          renderValueInput(item, '', '');
        } else {
          list.querySelectorAll('.mapping-item').forEach(item => {
            const sel = item.querySelector('.mapping-field-select');
            const savedSelector = item.dataset.savedSelector || '';
            const savedValue = item.dataset.savedValue || '';

            sel.innerHTML = '<option value="">-- Seleccionar campo o boton --</option>' + buildFieldOptions();

            if (savedSelector) {
              if (savedSelector.startsWith('radiogroup:')) {
                sel.value = savedSelector;
                renderValueInput(item, savedSelector, savedValue);
              } else {
                const matchIdx = detectedFields.findIndex(f => f.selector === savedSelector);
                if (matchIdx !== -1) {
                  sel.value = matchIdx.toString();
                  renderValueInput(item, matchIdx.toString(), savedValue);
                }
              }
            }
          });
        }

        showToast(`${detectedFields.length} elementos detectados`, 'success');
      } else {
        showToast('No se detectaron elementos', 'error');
      }
    } catch (err) {
      showToast('Error al escanear', 'error');
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
      const fieldIndex = item.querySelector('.mapping-field-select').value;
      const valueEl = item.querySelector('.mapping-value');
      const value = valueEl ? (valueEl.value || '').trim() : '';
      const savedSelector = item.dataset.savedSelector || '';

      if (fieldIndex.startsWith('radiogroup:')) {
        const radioName = fieldIndex.replace('radiogroup:', '');
        const radio = detectedFields.find(f => f.type === 'radio' && f.name === radioName && f.value === value);
        if (radio) {
          mappings.push({
            selector: radio.selector,
            value: radio.value,
            fieldType: 'radio',
            actionType: 'fill'
          });
        }
      } else if (fieldIndex !== '' && detectedFields[fieldIndex]) {
        const field = detectedFields[fieldIndex];
        mappings.push({
          selector: field.selector,
          value,
          fieldType: getFieldType(field),
          actionType: getFieldType(field) === 'button' ? 'click' : 'fill'
        });
      } else if (savedSelector) {
        mappings.push({
          selector: savedSelector,
          value: item.dataset.savedValue || value,
          fieldType: 'text',
          actionType: item.dataset.savedActionType || 'fill'
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
        mappings
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
    $('#setting-delay').value = settings.fillDelay;
    $('#setting-sequential').checked = settings.sequential;
  }

  async function saveSettings() {
    await Storage.saveSettings({
      fillDelay: parseInt($('#setting-delay').value) || 200,
      sequential: $('#setting-sequential').checked
    });
  }

  function init() {
    renderActiveProfile();
    loadSettings();

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
      const html = createMappingHtml(count, '', '', 'text', '');
      list.insertAdjacentHTML('beforeend', html);
      const newItem = list.lastElementChild;
      renderValueInput(newItem, '', '');
    });

    // Delegated events on mappings-list
    $('#mappings-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.remove-mapping-btn');
      if (btn) btn.closest('.mapping-item').remove();
    });

    $('#mappings-list').addEventListener('change', (e) => {
      if (e.target.classList.contains('mapping-field-select')) {
        const mappingItem = e.target.closest('.mapping-item');
        const fieldIndex = e.target.value;
        if (fieldIndex.startsWith('radiogroup:')) {
          mappingItem.dataset.savedSelector = fieldIndex;
        } else if (fieldIndex !== '' && detectedFields[fieldIndex]) {
          mappingItem.dataset.savedSelector = detectedFields[fieldIndex].selector;
        } else {
          mappingItem.dataset.savedSelector = '';
        }
        renderValueInput(mappingItem, fieldIndex, '');
      }
      if (e.target.classList.contains('mapping-value')) {
        const mappingItem = e.target.closest('.mapping-item');
        mappingItem.dataset.savedValue = e.target.value;
      }
    });

    $('#mappings-list').addEventListener('input', (e) => {
      if (e.target.classList.contains('mapping-value')) {
        const mappingItem = e.target.closest('.mapping-item');
        mappingItem.dataset.savedValue = e.target.value;
      }
    });

    // Settings view
    $('#btn-back-settings').addEventListener('click', () => {
      saveSettings();
      switchView('view-main');
    });
    $('#setting-delay').addEventListener('change', saveSettings);
    $('#setting-sequential').addEventListener('change', saveSettings);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
