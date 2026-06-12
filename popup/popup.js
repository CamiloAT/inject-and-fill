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

    display.innerHTML = `
      <div class="profile-name">${escapeHtml(profile.name)}</div>
      ${profile.description ? `<div class="profile-desc">${escapeHtml(profile.description)}</div>` : ''}
      <div class="profile-count">${profile.mappings ? profile.mappings.length : 0} campos</div>
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
      showToast('El perfil no tiene campos mapeados', 'error');
      return;
    }

    const settings = await Storage.getSettings();
    const fields = profile.mappings.map(m => ({
      selector: m.selector,
      value: m.value,
      fieldType: m.fieldType
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
        showToast(`Rellenados: ${success} | Fallidos: ${failed}`, success > 0 ? 'success' : 'error');
      }
    } catch (err) {
      showToast('Error al rellenar', 'error');
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
          <div class="profile-card-meta">${p.mappings ? p.mappings.length : 0} campos ${p.id === activeId ? '· Activo' : ''}</div>
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
  function openEditProfile(profile) {
    editingProfileId = profile ? profile.id : null;
    $('#edit-title').textContent = profile ? 'Editar Perfil' : 'Nuevo Perfil';
    $('#profile-name').value = profile ? profile.name : '';
    $('#profile-desc').value = profile ? (profile.description || '') : '';
    $('#scan-hint').style.display = 'none';

    const list = $('#mappings-list');
    if (profile && profile.mappings && profile.mappings.length > 0) {
      list.innerHTML = profile.mappings.map((m, i) =>
        createMappingHtml(i + 1, m.selector, m.value, m.fieldType)
      ).join('');
    } else {
      list.innerHTML = '';
    }

    switchView('view-edit-profile');
  }

  function getFieldLabel(f) {
    return f.label || f.name || f.placeholder || f.selector;
  }

  function getFieldType(f) {
    if (f.tag === 'select') return 'select';
    if (f.type === 'checkbox') return 'checkbox';
    if (f.type === 'radio') return 'radio';
    return 'text';
  }

  function createMappingHtml(num, savedSelector, savedValue, savedType) {
    return `
      <div class="mapping-item">
        <div class="mapping-header">
          <span class="mapping-num">Campo ${num}</span>
          <button class="icon-btn remove-mapping-btn" style="color:var(--danger);font-size:12px;">&#10005;</button>
        </div>
        <div class="mapping-row">
          <select class="mapping-field-select">
            <option value="">-- Seleccionar campo --</option>
            ${detectedFields.map((f, i) => {
              const label = getFieldLabel(f);
              const type = getFieldType(f);
              const selected = f.selector === savedSelector ? 'selected' : '';
              return `<option value="${i}" ${selected}>${escapeHtml(label)} (${type})</option>`;
            }).join('')}
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

    const field = detectedFields[fieldIndex];
    if (!field) {
      container.innerHTML = '';
      return;
    }

    const type = getFieldType(field);

    if (type === 'select' && field.options && field.options.length > 0) {
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
    } else if (type === 'checkbox') {
      container.innerHTML = `
        <div class="mapping-row">
          <select class="mapping-value mapping-value-check">
            <option value="true" ${savedValue === 'true' ? 'selected' : ''}>Marcar (checked)</option>
            <option value="false" ${savedValue === 'false' ? 'selected' : ''}>Desmarcar (unchecked)</option>
          </select>
        </div>
      `;
    } else if (type === 'radio') {
      container.innerHTML = `
        <div class="mapping-row">
          <span class="radio-hint">Se marcara este opcion</span>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="mapping-row">
          <input type="text" class="input mapping-value mapping-value-text" value="${escapeHtml(savedValue || '')}" placeholder="Valor a rellenar">
        </div>
      `;
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
          list.innerHTML = createMappingHtml(1, '', '', 'text');
          const item = list.querySelector('.mapping-item');
          renderValueInput(item, '', '');
        } else {
          list.querySelectorAll('.mapping-item').forEach(item => {
            const sel = item.querySelector('.mapping-field-select');
            const currentIdx = sel.value;
            sel.innerHTML = '<option value="">-- Seleccionar campo --</option>' + detectedFields.map((f, i) => {
              const label = getFieldLabel(f);
              const type = getFieldType(f);
              return `<option value="${i}">${escapeHtml(label)} (${type})</option>`;
            }).join('');
            sel.value = currentIdx;
            renderValueInput(item, currentIdx, '');
          });
        }

        showToast(`${detectedFields.length} campos detectados`, 'success');
      } else {
        showToast('No se detectaron campos', 'error');
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

      if (fieldIndex !== '' && detectedFields[fieldIndex]) {
        const field = detectedFields[fieldIndex];
        mappings.push({
          selector: field.selector,
          value,
          fieldType: getFieldType(field)
        });
      }
    });

    if (mappings.length === 0) {
      showToast('Agrega al menos un campo', 'error');
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
      const html = createMappingHtml(count, '', '', 'text');
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
        renderValueInput(mappingItem, e.target.value, '');
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
