(() => {
  let currentProfileId = null;
  let detectedFields = [];
  let autoDetectEnabled = false;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function showToast(msg, type = '') {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  function showModal(title, bodyHtml, onConfirm) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = bodyHtml;
    $('#modal-overlay').classList.remove('hidden');
    $('#modal-confirm').onclick = () => {
      onConfirm();
      $('#modal-overlay').classList.add('hidden');
    };
  }

  function hideModal() {
    $('#modal-overlay').classList.add('hidden');
  }

  function initTabs() {
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach(t => t.classList.remove('active'));
        $$('.tab-content').forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        $(`#tab-${tab.dataset.tab}`).classList.add('active');
      });
    });
  }

  async function renderProfiles() {
    const profiles = await Storage.getProfiles();
    const activeId = await Storage.getActiveProfile();
    const list = $('#profiles-list');

    if (profiles.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No hay perfiles creados</p><p class="subtext">Crea tu primer perfil para empezar</p></div>';
      return;
    }

    list.innerHTML = profiles.map(p => `
      <div class="card ${p.id === activeId ? 'active-profile' : ''}" data-id="${p.id}">
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(p.name)}</div>
            <div class="card-subtitle">${p.mappings ? p.mappings.length : 0} campos mapeados</div>
          </div>
          <div class="card-actions">
            ${p.id === activeId
              ? '<span style="font-size:11px;color:var(--success);">&#10003; Activo</span>'
              : `<button class="btn btn-success btn-sm activate-btn" data-id="${p.id}">Activar</button>`}
            <button class="btn btn-secondary btn-sm edit-btn" data-id="${p.id}">&#9998;</button>
            <button class="btn btn-danger btn-sm delete-btn" data-id="${p.id}">&#10005;</button>
          </div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.activate-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await Storage.setActiveProfile(btn.dataset.id);
        showToast('Perfil activado', 'success');
        renderProfiles();
      });
    });

    list.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const profile = profiles.find(p => p.id === btn.dataset.id);
        if (profile) openEditProfileModal(profile);
      });
    });

    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Eliminar este perfil?')) {
          await Storage.deleteProfile(btn.dataset.id);
          showToast('Perfil eliminado', 'success');
          renderProfiles();
        }
      });
    });
  }

  function openEditProfileModal(profile) {
    const fieldsHtml = profile.mappings && profile.mappings.length > 0
      ? profile.mappings.map((m, i) => `
        <div class="field-mapping-item">
          <div class="mapping-label">Campo ${i + 1}</div>
          <div class="mapping-row">
            <input type="text" class="input mapping-selector" value="${escapeHtml(m.selector || '')}" placeholder="Selector CSS">
            <input type="text" class="input mapping-value" value="${escapeHtml(m.value || '')}" placeholder="Valor">
            <select class="mapping-type" style="width:90px;padding:6px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:11px;">
              <option value="text" ${m.fieldType === 'text' ? 'selected' : ''}>Texto</option>
              <option value="select" ${m.fieldType === 'select' ? 'selected' : ''}>Select</option>
              <option value="checkbox" ${m.fieldType === 'checkbox' ? 'selected' : ''}>Checkbox</option>
              <option value="radio" ${m.fieldType === 'radio' ? 'selected' : ''}>Radio</option>
            </select>
          </div>
        </div>
      `).join('')
      : '<div class="empty-state"><p>No hay campos mapeados</p><p class="subtext">Detecta campos primero desde la pestana "Campos"</p></div>';

    const html = `
      <div class="form-group">
        <label>Nombre del Perfil</label>
        <input type="text" id="profile-name" class="input" value="${escapeHtml(profile.name)}">
      </div>
      <div class="form-group">
        <label>Descripcion (opcional)</label>
        <input type="text" id="profile-desc" class="input" value="${escapeHtml(profile.description || '')}" placeholder="Ej: Formulario de registro">
      </div>
      <div class="form-group">
        <label>Mapeo de Campos</label>
        <div class="field-mapping-list" id="modal-mappings">
          ${fieldsHtml}
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-add-mapping" style="margin-top:8px;">+ Agregar Campo</button>
      </div>
    `;

    showModal(`Editar: ${profile.name}`, html, async () => {
      const mappings = [];
      $$('#modal-mappings .field-mapping-item').forEach(item => {
        const selector = item.querySelector('.mapping-selector').value.trim();
        const value = item.querySelector('.mapping-value').value.trim();
        const fieldType = item.querySelector('.mapping-type').value;
        if (selector) {
          mappings.push({ selector, value, fieldType });
        }
      });

      await Storage.updateProfile(profile.id, {
        name: $('#profile-name').value.trim() || profile.name,
        description: $('#profile-desc').value.trim(),
        mappings
      });

      showToast('Perfil actualizado', 'success');
      renderProfiles();
    });

    setTimeout(() => {
      const addBtn = $('#btn-add-mapping');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const container = $('#modal-mappings');
          const div = document.createElement('div');
          div.className = 'field-mapping-item';
          div.innerHTML = `
            <div class="mapping-label">Nuevo Campo</div>
            <div class="mapping-row">
              <input type="text" class="input mapping-selector" placeholder="Selector CSS (ej: #nombre)">
              <input type="text" class="input mapping-value" placeholder="Valor a rellenar">
              <select class="mapping-type" style="width:90px;padding:6px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:11px;">
                <option value="text">Texto</option>
                <option value="select">Select</option>
                <option value="checkbox">Checkbox</option>
                <option value="radio">Radio</option>
              </select>
            </div>
          `;
          container.appendChild(div);
        });
      }
    }, 100);
  }

  function openNewProfileModal() {
    const html = `
      <div class="form-group">
        <label>Nombre del Perfil</label>
        <input type="text" id="profile-name" class="input" placeholder="Mi perfil">
      </div>
      <div class="form-group">
        <label>Descripcion (opcional)</label>
        <input type="text" id="profile-desc" class="input" placeholder="Ej: Formulario de registro">
      </div>
      <div class="form-group">
        <label>Mapeo de Campos</label>
        <div class="field-mapping-list" id="modal-mappings">
          <div class="field-mapping-item">
            <div class="mapping-label">Campo 1</div>
            <div class="mapping-row">
              <input type="text" class="input mapping-selector" placeholder="Selector CSS (ej: #nombre)">
              <input type="text" class="input mapping-value" placeholder="Valor a rellenar">
              <select class="mapping-type" style="width:90px;padding:6px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:11px;">
                <option value="text">Texto</option>
                <option value="select">Select</option>
                <option value="checkbox">Checkbox</option>
                <option value="radio">Radio</option>
              </select>
            </div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-add-mapping" style="margin-top:8px;">+ Agregar Campo</button>
      </div>
    `;

    showModal('Nuevo Perfil', html, async () => {
      const name = $('#profile-name').value.trim();
      if (!name) {
        showToast('Ingresa un nombre para el perfil', 'error');
        return;
      }

      const mappings = [];
      $$('#modal-mappings .field-mapping-item').forEach(item => {
        const selector = item.querySelector('.mapping-selector').value.trim();
        const value = item.querySelector('.mapping-value').value.trim();
        const fieldType = item.querySelector('.mapping-type').value;
        if (selector) {
          mappings.push({ selector, value, fieldType });
        }
      });

      const profile = await Storage.addProfile({
        name,
        description: $('#profile-desc').value.trim(),
        mappings
      });

      await Storage.setActiveProfile(profile.id);
      showToast('Perfil creado y activado', 'success');
      renderProfiles();
    });

    setTimeout(() => {
      const addBtn = $('#btn-add-mapping');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const container = $('#modal-mappings');
          const count = container.querySelectorAll('.field-mapping-item').length + 1;
          const div = document.createElement('div');
          div.className = 'field-mapping-item';
          div.innerHTML = `
            <div class="mapping-label">Campo ${count}</div>
            <div class="mapping-row">
              <input type="text" class="input mapping-selector" placeholder="Selector CSS">
              <input type="text" class="input mapping-value" placeholder="Valor">
              <select class="mapping-type" style="width:90px;padding:6px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:11px;">
                <option value="text">Texto</option>
                <option value="select">Select</option>
                <option value="checkbox">Checkbox</option>
                <option value="radio">Radio</option>
              </select>
            </div>
          `;
          container.appendChild(div);
        });
      }
    }, 100);
  }

  async function renderDetectedFields(fields) {
    detectedFields = fields;
    const list = $('#detected-fields');
    const msg = $('#no-fields-msg');

    if (!fields || fields.length === 0) {
      list.innerHTML = '';
      msg.classList.remove('hidden');
      return;
    }

    msg.classList.add('hidden');

    list.innerHTML = fields.map((f, i) => {
      let typeLabel = f.type;
      if (f.tag === 'select') typeLabel = 'select';
      else if (f.type === 'checkbox') typeLabel = 'checkbox';
      else if (f.type === 'radio') typeLabel = 'radio';

      const fieldLabel = f.label || f.name || f.placeholder || f.selector;

      return `
        <div class="field-row" data-index="${i}">
          <div class="field-checkbox">
            <input type="checkbox" class="field-select-cb" data-index="${i}" checked>
          </div>
          <div class="field-info">
            <div class="field-name" title="${escapeHtml(f.selector)}">${escapeHtml(fieldLabel)}</div>
            <div class="field-meta">${typeLabel} &middot; ${escapeHtml(f.selector)}</div>
          </div>
          <input type="text" class="input field-value-input" data-index="${i}" value="${escapeHtml(f.value || '')}" placeholder="Valor...">
        </div>
      `;
    }).join('');
  }

  async function detectFields() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'detectFields' });
      if (response && response.fields) {
        await renderDetectedFields(response.fields);
        showToast(`${response.fields.length} campos detectados`, 'success');
      }
    } catch (err) {
      showToast('Error detectando campos', 'error');
    }
  }

  async function fillActiveProfile() {
    const activeId = await Storage.getActiveProfile();
    if (!activeId) {
      showToast('No hay perfil activo', 'error');
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
        showToast(`Rellenados: ${success}, Fallidos: ${failed}`, success > 0 ? 'success' : 'error');
      }
    } catch (err) {
      showToast('Error al rellenar', 'error');
    }
  }

  async function loadSettings() {
    const settings = await Storage.getSettings();
    $('#fill-delay').value = settings.fillDelay;
    $('#sequential-fill').checked = settings.sequential;
  }

  async function saveCurrentSettings() {
    const settings = {
      fillDelay: parseInt($('#fill-delay').value) || 200,
      sequential: $('#sequential-fill').checked
    };
    await Storage.saveSettings(settings);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    initTabs();
    renderProfiles();
    loadSettings();

    $('#btn-new-profile').addEventListener('click', openNewProfileModal);
    $('#modal-close').addEventListener('click', hideModal);
    $('#modal-cancel').addEventListener('click', hideModal);
    $('#modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) hideModal();
    });

    $('#btn-detect-fields').addEventListener('click', detectFields);
    $('#btn-fill-active').addEventListener('click', fillActiveProfile);

    $('#btn-reload').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'reloadTab', bypassCache: false });
      showToast('Recargando...', 'success');
    });

    $('#btn-reload-cache').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'reloadTab', bypassCache: true });
      showToast('Recargando sin cache...', 'success');
    });

    $('#btn-navigate').addEventListener('click', () => {
      const url = $('#nav-url').value.trim();
      if (url) {
        chrome.runtime.sendMessage({ action: 'navigateTab', url });
        showToast('Navegando...', 'success');
      }
    });

    $('#btn-click-elem').addEventListener('click', () => {
      const selector = $('#click-selector').value.trim();
      if (selector) {
        chrome.runtime.sendMessage({ action: 'clickElement', selector });
        showToast('Click enviado', 'success');
      }
    });

    $('#auto-detect-toggle').addEventListener('change', async (e) => {
      autoDetectEnabled = e.target.checked;
      if (autoDetectEnabled) {
        chrome.runtime.sendMessage({ action: 'startAutoDetect' });
        detectFields();
        showToast('Auto-detectar activado', 'success');
      } else {
        chrome.runtime.sendMessage({ action: 'stopAutoDetect' });
        showToast('Auto-detectar desactivado', 'success');
      }
    });

    $('#fill-delay').addEventListener('change', saveCurrentSettings);
    $('#sequential-fill').addEventListener('change', saveCurrentSettings);

    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'fieldsUpdated' && autoDetectEnabled) {
        renderDetectedFields(message.fields);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
