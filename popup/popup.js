(() => {
  let editingProfileId = null;

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
      <div class="profile-count">${profile.mappings ? profile.mappings.length : 0} campos mapeados</div>
    `;
  }

  async function renderDetectedFields() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'detectFields' });
      if (response && response.fields) {
        const list = $('#fields-list');
        const count = $('#fields-count');
        count.textContent = `${response.fields.length} campos encontrados`;

        if (response.fields.length === 0) {
          list.innerHTML = '';
          return;
        }

        list.innerHTML = response.fields.map((f, i) => {
          const label = f.label || f.name || f.placeholder || f.selector;
          const type = f.tag === 'select' ? 'select' : f.type;
          return `
            <div class="field-item">
              <label title="${escapeHtml(f.selector)}">
                <input type="checkbox" data-index="${i}" checked>
                <span class="field-label">${escapeHtml(label)}</span>
                <span class="field-type">${type}</span>
              </label>
              <input type="text" data-index="${i}" value="${escapeHtml(f.value || '')}" placeholder="Valor...">
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      showToast('Error detectando campos', 'error');
    }
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

    const list = $('#mappings-list');
    if (profile && profile.mappings && profile.mappings.length > 0) {
      list.innerHTML = profile.mappings.map((m, i) => createMappingHtml(i + 1, m.selector, m.value, m.fieldType)).join('');
    } else {
      list.innerHTML = createMappingHtml(1, '', '', 'text');
    }

    switchView('view-edit-profile');
  }

  function createMappingHtml(num, selector, value, type) {
    return `
      <div class="mapping-item">
        <div class="mapping-header">
          <span class="mapping-num">Campo ${num}</span>
          <button class="icon-btn remove-mapping-btn" style="color:var(--danger);font-size:12px;">&#10005;</button>
        </div>
        <div class="mapping-row">
          <input type="text" class="input mapping-selector" value="${escapeHtml(selector || '')}" placeholder="Selector CSS">
        </div>
        <div class="mapping-row">
          <input type="text" class="input mapping-value" value="${escapeHtml(value || '')}" placeholder="Valor a rellenar">
          <select class="mapping-type">
            <option value="text" ${type === 'text' ? 'selected' : ''}>Texto</option>
            <option value="select" ${type === 'select' ? 'selected' : ''}>Select</option>
            <option value="checkbox" ${type === 'checkbox' ? 'selected' : ''}>Check</option>
            <option value="radio" ${type === 'radio' ? 'selected' : ''}>Radio</option>
          </select>
        </div>
      </div>
    `;
  }

  async function saveProfile() {
    const name = $('#profile-name').value.trim();
    if (!name) {
      showToast('Ingresa un nombre', 'error');
      return;
    }

    const mappings = [];
    $$('#mappings-list .mapping-item').forEach(item => {
      const selector = item.querySelector('.mapping-selector').value.trim();
      const value = item.querySelector('.mapping-value').value.trim();
      const fieldType = item.querySelector('.mapping-type').value;
      if (selector) mappings.push({ selector, value, fieldType });
    });

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
    $('#setting-autodetect').checked = settings.autoDetect || false;
  }

  async function saveSettings() {
    await Storage.saveSettings({
      fillDelay: parseInt($('#setting-delay').value) || 200,
      sequential: $('#setting-sequential').checked,
      autoDetect: $('#setting-autodetect').checked
    });
  }

  function init() {
    renderActiveProfile();
    loadSettings();

    // Main view buttons
    $('#btn-detect').addEventListener('click', renderDetectedFields);
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

    // Profile display click
    $('#active-profile-display').addEventListener('click', () => {
      renderProfiles();
      switchView('view-profiles');
    });

    // Profiles view
    $('#btn-manage-profiles').addEventListener('click', () => {
      renderProfiles();
      switchView('view-profiles');
    });
    $('#btn-back-profiles').addEventListener('click', () => {
      renderActiveProfile();
      switchView('view-main');
    });
    $('#btn-new-profile').addEventListener('click', () => openEditProfile(null));

    // Edit profile view
    $('#btn-back-edit').addEventListener('click', () => switchView('view-profiles'));
    $('#btn-save-profile').addEventListener('click', saveProfile);
    $('#btn-add-field').addEventListener('click', () => {
      const list = $('#mappings-list');
      const count = list.querySelectorAll('.mapping-item').length + 1;
      list.insertAdjacentHTML('beforeend', createMappingHtml(count, '', '', 'text'));
    });

    // Remove mapping
    $$('.mappings-list').forEach(list => {
      list.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-mapping-btn');
        if (btn) {
          btn.closest('.mapping-item').remove();
        }
      });
    });

    // Settings view
    $('#btn-back-settings').addEventListener('click', () => {
      saveSettings();
      switchView('view-main');
    });
    $('#setting-delay').addEventListener('change', saveSettings);
    $('#setting-sequential').addEventListener('change', saveSettings);
    $('#setting-autodetect').addEventListener('change', saveSettings);

    // Navigate and click views are opened via main - need separate buttons
    // For now they're accessible through settings or we can add them later
  }

  document.addEventListener('DOMContentLoaded', init);
})();
