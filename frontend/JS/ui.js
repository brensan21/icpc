/* ════════════════════════════════════════════
   ui.js — Utilidades de interfaz compartidas
════════════════════════════════════════════ */

const UI = (() => {

  // ── Toast ────────────────────────────────────
  let toastTimer = null;

  function toast(msg, type = 'info') {
    const el    = document.getElementById('toast');
    const inner = document.getElementById('toast-inner');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    inner.className = `toast-inner ${type}`;
    inner.innerHTML = `${icons[type] || 'ℹ️'} ${msg}`;
    el.classList.remove('hidden');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.classList.add('hidden'), 300);
    }, 3200);
  }

  // ── Modal ────────────────────────────────────
  let modalSaveCallback = null;

  function openModal(title, bodyHTML, onSave) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal').classList.remove('hidden');
    modalSaveCallback = onSave;
  }

  function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    modalSaveCallback = null;
  }

  function triggerModalSave() {
    if (typeof modalSaveCallback === 'function') modalSaveCallback();
  }

  // ── Tabla HTML ───────────────────────────────
  /**
   * Genera el HTML de una tabla de datos.
   * @param {string[]} columns   - Nombres de columnas
   * @param {object[]} rows      - Filas de datos
   * @param {object}   opts      - { pkField, isAdmin, onEdit, onDelete }
   */
  function buildTable(columns, rows, opts = {}) {
    const { pkField, isAdmin, onEdit, onDelete } = opts;

    if (rows.length === 0) {
      return `<div style="padding:40px;text-align:center;color:var(--text3)">Sin registros encontrados</div>`;
    }

    let html = `<table class="data-table"><thead><tr>`;
    columns.forEach(col => {
      const isPK = col === pkField;
      html += `<th>${isPK ? '<span class="pk-badge">PK</span>' : ''}${col}</th>`;
    });
    if (isAdmin) html += `<th>Acciones</th>`;
    html += `</tr></thead><tbody>`;

    rows.forEach((row, i) => {
      html += `<tr>`;
      columns.forEach(col => {
        const val = row[col];
        html += `<td title="${val ?? ''}">${val !== null && val !== undefined ? val : '<span style="color:var(--text3)">NULL</span>'}</td>`;
      });
      if (isAdmin) {
        html += `<td><div class="action-cell">
          <button class="icon-btn edit" data-idx="${i}" title="Editar">✏️</button>
          <button class="icon-btn del"  data-idx="${i}" title="Eliminar">🗑️</button>
        </div></td>`;
      }
      html += `</tr>`;
    });

    html += `</tbody></table>`;

    // Bind events after render (called after insertAdjacentHTML)
    return html;
  }

  // ── Formulario dinámico para modal ──────────
  function buildForm(fields, currentValues = {}) {
    return fields.map(f => {
      const val = currentValues[f.Field] !== undefined ? currentValues[f.Field] : '';
      const isPK = f.Key === 'PRI';
      const isFk = f.Key === 'MUL';
      const label = `${isPK ? '🔑 ' : isFk ? '🔗 ' : ''}${f.Field} <span style="color:var(--text3);font-size:10px">${f.Type}</span>`;
      return `
        <div class="form-group">
          <label class="form-label">${label}</label>
          <input class="form-input"
            id="field-${f.Field}"
            name="${f.Field}"
            value="${escapeHTML(String(val))}"
            placeholder="${f.Type}"
            ${isPK ? 'readonly' : ''}
          />
        </div>
      `;
    }).join('');
  }

  // ── Utilidades HTML ──────────────────────────
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Spinner inline ───────────────────────────
  function spinner(msg = 'Cargando…') {
    return `<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px">${msg}</div>`;
  }

  // ── Tabs ─────────────────────────────────────
  function switchTab(panelName) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.panel === panelName);
    });
    document.querySelectorAll('.panel').forEach(p => {
      p.classList.toggle('hidden', p.id !== `panel-${panelName}`);
      p.classList.toggle('active', p.id === `panel-${panelName}`);
    });
  }

  return {
    toast,
    openModal, closeModal, triggerModalSave,
    buildTable, buildForm,
    escapeHTML, spinner, switchTab,
  };
})();
