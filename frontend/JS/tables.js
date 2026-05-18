/* ════════════════════════════════════════════
   tables.js — Visualizador de tablas + CRUD
════════════════════════════════════════════ */

const Tables = (() => {
  const PAGE_SIZE = 50;

  let state = {
    currentTable: null,
    schema:       [],      // campos DESCRIBE
    rows:         [],      // página actual
    total:        0,
    page:         1,
    search:       '',
    role:         'user',
  };

  // ── Init ─────────────────────────────────────
  async function init(role) {
    state.role = role;

    if (role === 'user') {
      document.getElementById('readonly-notice').classList.remove('hidden');
    }

    const res = await API.getTables();
    if (!res.success) {
      UI.toast('Error cargando tablas: ' + res.error, 'error');
      return;
    }

    renderSidebar(res.tables);
  }

  // ── Sidebar ──────────────────────────────────
  function renderSidebar(tables) {
    const cont = document.getElementById('sidebar-tables');
    if (!tables.length) {
      cont.innerHTML = '<div class="sidebar-loading">No se encontraron tablas</div>';
      return;
    }

    cont.innerHTML = tables.map(name => `
      <div class="table-item" id="sidebar-item-${name}" data-table="${name}">
        <div class="table-item-name">
          <span class="table-dot"></span>
          ${name}
        </div>
        <span class="table-count" id="count-${name}">…</span>
      </div>
    `).join('');

    cont.querySelectorAll('.table-item').forEach(el => {
      el.addEventListener('click', () => loadTable(el.dataset.table));
    });

    // Cargar counts en paralelo
    tables.forEach(async name => {
      const r = await API.getRows(name, { limit: 1, offset: 0 });
      const el = document.getElementById(`count-${name}`);
      if (el) el.textContent = r.success ? r.total : '?';
    });
  }

  // ── Load table ───────────────────────────────
  async function loadTable(name) {
    state.currentTable = name;
    state.page = 1;
    state.search = '';

    document.getElementById('search-box').value = '';
    document.getElementById('filter-info').textContent = '';

    // Highlight sidebar
    document.querySelectorAll('.table-item').forEach(el => {
      el.classList.toggle('active', el.dataset.table === name);
    });

    document.getElementById('table-toolbar').classList.remove('hidden');
    document.getElementById('current-table-title').innerHTML = `${name} <span>cargando…</span>`;
    document.getElementById('table-actions').innerHTML = '';
    document.getElementById('table-container').innerHTML = UI.spinner();
    document.getElementById('pagination').classList.add('hidden');

    // Esquema
    const schemaRes = await API.getSchema(name);
    if (!schemaRes.success) {
      UI.toast('Error cargando esquema: ' + schemaRes.error, 'error');
      return;
    }
    state.schema = schemaRes.fields;

    await fetchAndRender();
    renderActions();
  }

  // ── Fetch + render ───────────────────────────
  async function fetchAndRender() {
    const name   = state.currentTable;
    const offset = (state.page - 1) * PAGE_SIZE;

    const res = await API.getRows(name, {
      limit:  PAGE_SIZE,
      offset,
      search: state.search,
    });

    if (!res.success) {
      document.getElementById('table-container').innerHTML =
        `<div style="padding:30px;color:var(--danger)">❌ ${res.error}</div>`;
      return;
    }

    state.rows  = res.rows;
    state.total = res.total;

    const columns  = state.schema.map(f => f.Field);
    const pkField  = (state.schema.find(f => f.Key === 'PRI') || {}).Field;
    const isAdmin  = state.role === 'admin';
    const totalPages = Math.ceil(state.total / PAGE_SIZE);

    document.getElementById('current-table-title').innerHTML =
      `${name} <span>${state.total} registros</span>`;

    // Actualizar count en sidebar
    const countEl = document.getElementById(`count-${name}`);
    if (countEl) countEl.textContent = state.total;

    // Render table
    const wrap = document.getElementById('table-container');
    wrap.innerHTML = `<div class="data-table-wrap">${UI.buildTable(columns, res.rows, { pkField, isAdmin })}</div>`;

    // Bind row buttons
    if (isAdmin) {
      wrap.querySelectorAll('.icon-btn.edit').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.idx)));
      });
      wrap.querySelectorAll('.icon-btn.del').forEach(btn => {
        btn.addEventListener('click', () => confirmDelete(parseInt(btn.dataset.idx)));
      });
    }

    // Pagination
    const pg = document.getElementById('pagination');
    pg.classList.toggle('hidden', totalPages <= 1);
    document.getElementById('pg-label').textContent = `Página ${state.page} de ${totalPages || 1}`;
    document.getElementById('pg-total').textContent =
      `Mostrando ${offset + 1}–${Math.min(offset + PAGE_SIZE, state.total)} de ${state.total}`;
    document.getElementById('pg-prev').disabled = state.page <= 1;
    document.getElementById('pg-next').disabled = state.page >= totalPages;
    document.getElementById('filter-info').textContent =
      state.search ? `${state.total} resultados` : '';
  }

  // ── Actions bar ──────────────────────────────
  function renderActions() {
    const cont = document.getElementById('table-actions');
    if (state.role === 'admin') {
      cont.innerHTML = `
        <button class="btn btn-primary" id="btn-add-row">+ Nuevo registro</button>
        <button class="btn btn-ghost"   id="btn-export">⬇ Export CSV</button>
      `;
      document.getElementById('btn-add-row').addEventListener('click', openAddModal);
      document.getElementById('btn-export').addEventListener('click', exportCSV);
    } else {
      cont.innerHTML = `<button class="btn btn-ghost" id="btn-export">⬇ Export CSV</button>`;
      document.getElementById('btn-export').addEventListener('click', exportCSV);
    }
  }

  // ── Add Modal ────────────────────────────────
  function openAddModal() {
    const editableFields = state.schema.filter(f => f.Key !== 'PRI' || f.Extra !== 'auto_increment');
    const formHTML = UI.buildForm(state.schema.filter(f => f.Key !== 'PRI'), {});
    UI.openModal(`➕ Nuevo registro — ${state.currentTable}`, formHTML, async () => {
      const data = collectForm(state.schema.filter(f => f.Key !== 'PRI'));
      const res  = await API.insertRow(state.currentTable, data);
      if (!res.success) { UI.toast('Error: ' + res.error, 'error'); return; }
      UI.closeModal();
      UI.toast('Registro insertado', 'success');
      await fetchAndRender();
    });
  }

  // ── Edit Modal ───────────────────────────────
  function openEditModal(idx) {
    const row     = state.rows[idx];
    const pkField = (state.schema.find(f => f.Key === 'PRI') || {}).Field;
    const formHTML = UI.buildForm(state.schema, row);

    UI.openModal(`✏️ Editar registro — ${state.currentTable}`, formHTML, async () => {
      const editableFields = state.schema.filter(f => f.Key !== 'PRI');
      const data = collectForm(editableFields);
      const res  = await API.updateRow(state.currentTable, pkField, row[pkField], data);
      if (!res.success) { UI.toast('Error: ' + res.error, 'error'); return; }
      UI.closeModal();
      UI.toast('Registro actualizado', 'success');
      await fetchAndRender();
    });
  }

  // ── Delete ───────────────────────────────────
  async function confirmDelete(idx) {
    const row     = state.rows[idx];
    const pkField = (state.schema.find(f => f.Key === 'PRI') || {}).Field;
    const pkValue = row[pkField];

    if (!confirm(`¿Eliminar el registro con ${pkField} = ${pkValue}?\nEsta acción no se puede deshacer.`)) return;

    const res = await API.deleteRow(state.currentTable, pkField, pkValue);
    if (!res.success) { UI.toast('Error: ' + res.error, 'error'); return; }
    UI.toast('Registro eliminado', 'error');
    await fetchAndRender();
  }

  // ── Form collection ──────────────────────────
  function collectForm(fields) {
    const data = {};
    fields.forEach(f => {
      const input = document.getElementById(`field-${f.Field}`);
      if (input) data[f.Field] = input.value === '' ? null : input.value;
    });
    return data;
  }

  // ── Search ───────────────────────────────────
  async function onSearch(value) {
    state.search = value;
    state.page = 1;
    await fetchAndRender();
  }

  // ── Pagination ───────────────────────────────
  async function changePage(dir) {
    const totalPages = Math.ceil(state.total / PAGE_SIZE);
    state.page = Math.max(1, Math.min(totalPages, state.page + dir));
    await fetchAndRender();
  }

  // ── Export CSV ───────────────────────────────
  async function exportCSV() {
    UI.toast('Descargando CSV…', 'info');
    // Traer todos los registros
    const res = await API.getRows(state.currentTable, { limit: 9999, offset: 0 });
    if (!res.success) { UI.toast('Error: ' + res.error, 'error'); return; }

    const columns = state.schema.map(f => f.Field);
    let csv = columns.join(',') + '\n';
    res.rows.forEach(row => {
      csv += columns.map(c => `"${(row[c] ?? '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.currentTable}.csv`;
    a.click();
    UI.toast(`${state.currentTable}.csv descargado`, 'success');
  }

  return { init, loadTable, onSearch, changePage };
})();
