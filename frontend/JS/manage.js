/* ════════════════════════════════════════════
   manage.js — Gestión de Fechas y Problemas
   Solo para administradores.
════════════════════════════════════════════ */

const Manage = (() => {
  let activeManageTab = 'fechas';

  // Esquemas locales (evita llamadas extra a DESCRIBE)
  const FECHAS_FIELDS = [
    { Field: 'id_fecha',    Type: 'INT',         Key: 'PRI', Extra: 'auto_increment', Null: 'NO' },
    { Field: 'Fecha',       Type: 'DATE',         Key: '',    Extra: '',               Null: 'NO' },
    { Field: 'Tipo_ronda',  Type: 'VARCHAR(80)',  Key: '',    Extra: '',               Null: 'YES' },
  ];

  const PROBLEMAS_FIELDS = [
    { Field: 'id_problema', Type: 'INT',          Key: 'PRI', Extra: 'auto_increment', Null: 'NO' },
    { Field: 'Nombre',      Type: 'VARCHAR(150)', Key: '',    Extra: '',               Null: 'NO' },
    { Field: 'Descripcion', Type: 'TEXT',         Key: '',    Extra: '',               Null: 'YES' },
    { Field: 'Teoria',      Type: 'VARCHAR(100)', Key: '',    Extra: '',               Null: 'YES' },
    { Field: 'id_fecha',    Type: 'INT',          Key: 'MUL', Extra: '',               Null: 'YES' },
  ];

  // ── Init ─────────────────────────────────────
  async function init() {
    bindManageTabs();
    await loadFechas();
    bindFechasBtn();
    bindProblemasBtn();
  }

  // ── Sub-tabs Fechas / Problemas ──────────────
  function bindManageTabs() {
    document.querySelectorAll('.manage-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        activeManageTab = btn.dataset.manage;
        document.querySelectorAll('.manage-tab').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('manage-fechas').classList.toggle('hidden', activeManageTab !== 'fechas');
        document.getElementById('manage-problemas').classList.toggle('hidden', activeManageTab !== 'problemas');

        if (activeManageTab === 'fechas') await loadFechas();
        if (activeManageTab === 'problemas') await loadProblemas();
      });
    });
  }

  // ════════════════════════════════════════════
  // FECHAS
  // ════════════════════════════════════════════
  async function loadFechas() {
    const cont = document.getElementById('fechas-table-container');
    cont.innerHTML = UI.spinner();

    const res = await API.getRows('Fechas', { limit: 999 });
    if (!res.success) {
      cont.innerHTML = `<div style="color:var(--danger);padding:20px">❌ ${res.error}</div>`;
      return;
    }

    document.getElementById('fechas-count').textContent = `${res.rows.length} fechas registradas`;

    if (!res.rows.length) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><div>No hay fechas registradas</div></div>`;
      return;
    }

    let html = `<div class="data-table-wrap"><table class="data-table"><thead><tr>
      <th><span class="pk-badge">PK</span>id_fecha</th>
      <th>Fecha</th>
      <th>Tipo de ronda</th>
      <th>Acciones</th>
    </tr></thead><tbody>`;

    res.rows.forEach(row => {
      html += `<tr>
        <td>${row.id_fecha}</td>
        <td>${row.Fecha ?? '<span style="color:var(--text3)">NULL</span>'}</td>
        <td>${row.Tipo_ronda ?? '<span style="color:var(--text3)">NULL</span>'}</td>
        <td><div class="action-cell">
          <button class="icon-btn edit" data-id="${row.id_fecha}" data-fecha="${UI.escapeHTML(row.Fecha ?? '')}" data-tipo="${UI.escapeHTML(row.Tipo_ronda ?? '')}" title="Editar">✏️</button>
          <button class="icon-btn del"  data-id="${row.id_fecha}" title="Eliminar">🗑️</button>
        </div></td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    cont.innerHTML = html;

    // Bind edit/delete
    cont.querySelectorAll('.icon-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => openFechaModal(btn.dataset.id, btn.dataset.fecha, btn.dataset.tipo));
    });
    cont.querySelectorAll('.icon-btn.del').forEach(btn => {
      btn.addEventListener('click', () => deleteFecha(btn.dataset.id));
    });
  }

  function bindFechasBtn() {
    document.getElementById('btn-add-fecha').addEventListener('click', () => openFechaModal(null, '', ''));
  }

  function openFechaModal(id, fecha, tipo) {
    const isEdit = id !== null;
    const title  = isEdit ? `✏️ Editar Fecha #${id}` : '➕ Nueva Fecha';

    const body = `
      ${isEdit ? `<div class="form-group"><label class="form-label">🔑 id_fecha</label><input class="form-input" value="${id}" readonly /></div>` : ''}
      <div class="form-group">
        <label class="form-label">Fecha <span style="color:var(--danger)">*</span></label>
        <input class="form-input" id="mf-fecha" type="date" value="${fecha}" />
      </div>
      <div class="form-group">
        <label class="form-label">Tipo de ronda</label>
        <select class="form-input" id="mf-tipo">
          <option value="">— Selecciona —</option>
          ${['Regional','Nacional','Internacional','Clasificatoria','Final'].map(t =>
            `<option value="${t}" ${tipo === t ? 'selected' : ''}>${t}</option>`
          ).join('')}
        </select>
      </div>
    `;

    UI.openModal(title, body, async () => {
      const fechaVal = document.getElementById('mf-fecha').value;
      const tipoVal  = document.getElementById('mf-tipo').value;

      if (!fechaVal) { UI.toast('La fecha es obligatoria', 'error'); return; }

      const data = { Fecha: fechaVal, Tipo_ronda: tipoVal || null };
      let res;

      if (isEdit) {
        res = await API.updateRow('Fechas', 'id_fecha', id, data);
      } else {
        res = await API.insertRow('Fechas', data);
      }

      if (!res.success) { UI.toast('Error: ' + res.error, 'error'); return; }
      UI.closeModal();
      UI.toast(isEdit ? 'Fecha actualizada' : 'Fecha creada', 'success');
      await loadFechas();
    });
  }

  async function deleteFecha(id) {
    if (!confirm(`¿Eliminar la fecha con id ${id}?\nEsto puede afectar Problemas y Racking relacionados.`)) return;
    const res = await API.deleteRow('Fechas', 'id_fecha', id);
    if (!res.success) { UI.toast('Error: ' + res.error, 'error'); return; }
    UI.toast('Fecha eliminada', 'error');
    await loadFechas();
  }

  // ════════════════════════════════════════════
  // PROBLEMAS
  // ════════════════════════════════════════════
  async function loadProblemas() {
    const cont = document.getElementById('problemas-table-container');
    cont.innerHTML = UI.spinner();

    // Cargar problemas y fechas en paralelo
    const [probRes, fechaRes] = await Promise.all([
      API.getRows('Problemas', { limit: 999 }),
      API.getRows('Fechas',    { limit: 999 }),
    ]);

    if (!probRes.success) {
      cont.innerHTML = `<div style="color:var(--danger);padding:20px">❌ ${probRes.error}</div>`;
      return;
    }

    const fechasMap = {};
    if (fechaRes.success) {
      fechaRes.rows.forEach(f => { fechasMap[f.id_fecha] = `${f.Fecha} (${f.Tipo_ronda})`; });
    }

    document.getElementById('problemas-count').textContent = `${probRes.rows.length} problemas registrados`;

    if (!probRes.rows.length) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-icon">🧩</div><div>No hay problemas registrados</div></div>`;
      return;
    }

    let html = `<div class="data-table-wrap"><table class="data-table"><thead><tr>
      <th><span class="pk-badge">PK</span>id_problema</th>
      <th>Nombre</th>
      <th>Descripción</th>
      <th>Teoría</th>
      <th>Fecha</th>
      <th>Acciones</th>
    </tr></thead><tbody>`;

    probRes.rows.forEach(row => {
      const fechaLabel = row.id_fecha ? (fechasMap[row.id_fecha] || row.id_fecha) : '<span style="color:var(--text3)">NULL</span>';
      html += `<tr>
        <td>${row.id_problema}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${UI.escapeHTML(row.Nombre ?? '')}">${UI.escapeHTML(row.Nombre ?? '')}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${UI.escapeHTML(row.Descripcion ?? '')}">${UI.escapeHTML(row.Descripcion ?? '') || '<span style="color:var(--text3)">NULL</span>'}</td>
        <td>${UI.escapeHTML(row.Teoria ?? '') || '<span style="color:var(--text3)">NULL</span>'}</td>
        <td>${fechaLabel}</td>
        <td><div class="action-cell">
          <button class="icon-btn edit"
            data-id="${row.id_problema}"
            data-nombre="${UI.escapeHTML(row.Nombre ?? '')}"
            data-desc="${UI.escapeHTML(row.Descripcion ?? '')}"
            data-teoria="${UI.escapeHTML(row.Teoria ?? '')}"
            data-idfecha="${row.id_fecha ?? ''}"
            title="Editar">✏️</button>
          <button class="icon-btn del" data-id="${row.id_problema}" title="Eliminar">🗑️</button>
        </div></td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    cont.innerHTML = html;

    // Bind
    cont.querySelectorAll('.icon-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => openProblemaModal(
        btn.dataset.id, btn.dataset.nombre, btn.dataset.desc,
        btn.dataset.teoria, btn.dataset.idfecha, fechaRes.rows
      ));
    });
    cont.querySelectorAll('.icon-btn.del').forEach(btn => {
      btn.addEventListener('click', () => deleteProblema(btn.dataset.id));
    });
  }

  function bindProblemasBtn() {
    document.getElementById('btn-add-problema').addEventListener('click', async () => {
      const fechaRes = await API.getRows('Fechas', { limit: 999 });
      openProblemaModal(null, '', '', '', '', fechaRes.success ? fechaRes.rows : []);
    });
  }

  function openProblemaModal(id, nombre, desc, teoria, idFecha, fechas) {
    const isEdit = id !== null;
    const title  = isEdit ? `✏️ Editar Problema #${id}` : '➕ Nuevo Problema';

    const fechaOptions = fechas.map(f =>
      `<option value="${f.id_fecha}" ${String(idFecha) === String(f.id_fecha) ? 'selected' : ''}>${f.Fecha} — ${f.Tipo_ronda}</option>`
    ).join('');

    const body = `
      ${isEdit ? `<div class="form-group"><label class="form-label">🔑 id_problema</label><input class="form-input" value="${id}" readonly /></div>` : ''}
      <div class="form-group">
        <label class="form-label">Nombre <span style="color:var(--danger)">*</span></label>
        <input class="form-input" id="mp-nombre" type="text" value="${nombre}" placeholder="Ej. Two Sum" />
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <input class="form-input" id="mp-desc" type="text" value="${desc}" placeholder="Breve descripción del problema" />
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Teoría / Categoría</label>
          <input class="form-input" id="mp-teoria" type="text" value="${teoria}" placeholder="Ej. Grafos, DP, Hash Map…" />
        </div>
        <div class="form-group">
          <label class="form-label">🔗 Fecha de competencia</label>
          <select class="form-input" id="mp-fecha">
            <option value="">— Sin asignar —</option>
            ${fechaOptions}
          </select>
        </div>
      </div>
    `;

    UI.openModal(title, body, async () => {
      const nombreVal = document.getElementById('mp-nombre').value.trim();
      if (!nombreVal) { UI.toast('El nombre del problema es obligatorio', 'error'); return; }

      const data = {
        Nombre:      nombreVal,
        Descripcion: document.getElementById('mp-desc').value.trim()    || null,
        Teoria:      document.getElementById('mp-teoria').value.trim()   || null,
        id_fecha:    document.getElementById('mp-fecha').value           || null,
      };

      let res;
      if (isEdit) {
        res = await API.updateRow('Problemas', 'id_problema', id, data);
      } else {
        res = await API.insertRow('Problemas', data);
      }

      if (!res.success) { UI.toast('Error: ' + res.error, 'error'); return; }
      UI.closeModal();
      UI.toast(isEdit ? 'Problema actualizado' : 'Problema creado', 'success');
      await loadProblemas();
    });
  }

  async function deleteProblema(id) {
    if (!confirm(`¿Eliminar el problema con id ${id}?`)) return;
    const res = await API.deleteRow('Problemas', 'id_problema', id);
    if (!res.success) { UI.toast('Error: ' + res.error, 'error'); return; }
    UI.toast('Problema eliminado', 'error');
    await loadProblemas();
  }

  return { init };
})();
