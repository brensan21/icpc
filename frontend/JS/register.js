/* ════════════════════════════════════════════
   register.js — Registro de nuevos participantes
   Disponible para admin y usuario.
════════════════════════════════════════════ */

const Register = (() => {
  let teamMode = 'existing'; // 'existing' | 'new'
  let recentRegistrations = [];

  // ── Init ─────────────────────────────────────
  async function init() {
    await loadEquipos();
    bindToggle();
    bindSubmit();
    bindClear();
  }

  // ── Cargar equipos existentes en el select ───
  async function loadEquipos() {
    const sel = document.getElementById('reg-equipo-existing');
    sel.innerHTML = '<option value="">Cargando…</option>';

    const res = await API.getRows('Equipo', { limit: 999 });
    if (!res.success) {
      sel.innerHTML = '<option value="">Error cargando equipos</option>';
      return;
    }
    if (!res.rows.length) {
      sel.innerHTML = '<option value="">No hay equipos — crea uno nuevo</option>';
      return;
    }
    sel.innerHTML = '<option value="">— Selecciona un equipo —</option>' +
      res.rows.map(e => `<option value="${e.id_equipo}">${UI.escapeHTML(e.Nombre)}</option>`).join('');
  }

  // ── Toggle equipo existente / nuevo ──────────
  function bindToggle() {
    document.getElementById('toggle-existing').addEventListener('click', () => setTeamMode('existing'));
    document.getElementById('toggle-new').addEventListener('click', () => setTeamMode('new'));
  }

  function setTeamMode(mode) {
    teamMode = mode;
    document.getElementById('toggle-existing').classList.toggle('active', mode === 'existing');
    document.getElementById('toggle-new').classList.toggle('active', mode === 'new');
    document.getElementById('team-existing').classList.toggle('hidden', mode !== 'existing');
    document.getElementById('team-new').classList.toggle('hidden', mode !== 'new');
  }

  // ── Submit ───────────────────────────────────
  function bindSubmit() {
    document.getElementById('reg-submit-btn').addEventListener('click', submitRegistration);
  }

  async function submitRegistration() {
    hideFeedback();

    // ── Validar campos ────────────────────────
    const nombre      = document.getElementById('reg-nombre').value.trim();
    const correo      = document.getElementById('reg-correo').value.trim();
    const edad        = document.getElementById('reg-edad').value.trim();
    const rol         = document.getElementById('reg-rol').value;
    const fechaInicio = document.getElementById('reg-fecha-inicio').value;
    const fechaFin    = document.getElementById('reg-fecha-fin').value;

    if (!nombre || !correo || !edad || !rol || !fechaInicio) {
      showFeedback('❌ Completa todos los campos obligatorios (marcados con *).', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      showFeedback('❌ El correo no tiene un formato válido.', 'error');
      return;
    }

    const btn = document.getElementById('reg-submit-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Registrando…';

    try {
      // ── Paso 1: resolver id_equipo ────────────
      let idEquipo;
      let nombreEquipo;

      if (teamMode === 'existing') {
        idEquipo = document.getElementById('reg-equipo-existing').value;
        if (!idEquipo) {
          showFeedback('❌ Selecciona un equipo existente o crea uno nuevo.', 'error');
          return;
        }
        nombreEquipo = document.getElementById('reg-equipo-existing').selectedOptions[0].textContent;

      } else {
        // Crear equipo nuevo primero
        const nombreNuevo = document.getElementById('reg-equipo-nuevo').value.trim();
        if (!nombreNuevo) {
          showFeedback('❌ Escribe el nombre del nuevo equipo.', 'error');
          return;
        }
        const equipoRes = await API.insertRow('Equipo', { Nombre: nombreNuevo });
        if (!equipoRes.success) {
          showFeedback(`❌ Error creando equipo: ${equipoRes.error}`, 'error');
          return;
        }
        idEquipo = equipoRes.insertId;
        nombreEquipo = nombreNuevo;

        // Recargar select de equipos para futuras selecciones
        await loadEquipos();
      }

      // ── Paso 2: insertar participante ─────────
      const participante = {
        Nombre:       nombre,
        Correo:       correo,
        Fecha_inicio: fechaInicio,
        Fecha_fin:    fechaFin || null,
        Edad:         parseInt(edad),
        Rol:          rol,
        id_equipo:    idEquipo,
      };

      const partRes = await API.insertRow('Participantes', participante);
      if (!partRes.success) {
        showFeedback(`❌ Error registrando participante: ${partRes.error}`, 'error');
        return;
      }

      // ── Éxito ─────────────────────────────────
      showFeedback(`✅ Participante <strong>${nombre}</strong> registrado correctamente en el equipo <strong>${nombreEquipo}</strong>.`, 'success');
      addToRecent({ nombre, correo, rol, nombreEquipo, id: partRes.insertId });
      clearForm();
      UI.toast('Participante registrado', 'success');

    } finally {
      btn.disabled = false;
      btn.textContent = '✅ Registrar Participante';
    }
  }

  // ── Clear ────────────────────────────────────
  function bindClear() {
    document.getElementById('reg-clear-btn').addEventListener('click', () => {
      clearForm();
      hideFeedback();
    });
  }

  function clearForm() {
    ['reg-nombre','reg-correo','reg-edad','reg-fecha-inicio','reg-fecha-fin','reg-equipo-nuevo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('reg-rol').value = '';
    document.getElementById('reg-equipo-existing').selectedIndex = 0;
    setTeamMode('existing');
  }

  // ── Feedback ─────────────────────────────────
  function showFeedback(html, type) {
    const el = document.getElementById('reg-feedback');
    el.className = `reg-feedback ${type}`;
    el.innerHTML = html;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideFeedback() {
    document.getElementById('reg-feedback').classList.add('hidden');
  }

  // ── Últimos registros ────────────────────────
  function addToRecent(entry) {
    recentRegistrations.unshift(entry);
    if (recentRegistrations.length > 8) recentRegistrations.pop();
    renderRecent();
  }

  function renderRecent() {
    const cont = document.getElementById('reg-recent-list');
    cont.innerHTML = recentRegistrations.map(r => `
      <div class="recent-item">
        <div class="recent-item-name">${UI.escapeHTML(r.nombre)}</div>
        <div class="recent-item-meta">${UI.escapeHTML(r.correo)} · ${UI.escapeHTML(r.rol)}</div>
        <div class="recent-item-team">🏆 ${UI.escapeHTML(r.nombreEquipo)}</div>
      </div>
    `).join('');
  }

  return { init, loadEquipos };
})();
