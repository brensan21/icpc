/* ════════════════════════════════════════════
   sql.js — SQL Terminal
════════════════════════════════════════════ */

const SQL = (() => {
  const history = [];
  const MAX_HISTORY = 15;

  const EXAMPLE_QUERIES = [
    'SELECT * FROM Equipo;',
    'SELECT * FROM Participantes LIMIT 20;',
    'SELECT * FROM Racking ORDER BY Puntaje DESC;',
    'SELECT p.Nombre, p.Correo, e.Nombre AS Equipo\nFROM Participantes p\nJOIN Equipo e ON p.id_equipo = e.id_equipo;',
    'SELECT f.Fecha, f.Tipo_ronda, COUNT(pr.id_problema) AS Problemas\nFROM Fechas f\nLEFT JOIN Problemas pr ON f.id_fecha = pr.id_fecha\nGROUP BY f.id_fecha;',
    'SELECT e.Nombre, r.Posicion, r.Puntaje\nFROM Racking r\nJOIN Equipo e ON r.id_equipo = e.id_equipo\nORDER BY r.Posicion;',
    'SHOW TABLES;',
    'DESCRIBE Participantes;',
  ];

  // ── Init ─────────────────────────────────────
  function init(role) {
    const badge = document.getElementById('sql-mode-badge');
    if (role === 'admin') {
      badge.textContent = 'READ / WRITE';
      badge.className   = 'sql-mode-badge readwrite';
    } else {
      badge.textContent = 'READ ONLY';
      badge.className   = 'sql-mode-badge readonly';
    }

    renderExamples();

    // Ctrl+Enter para ejecutar
    document.getElementById('sql-input').addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        run();
      }
    });
  }

  // ── Set query from outside ───────────────────
  function setQuery(q) {
    document.getElementById('sql-input').value = q;
    document.getElementById('sql-input').focus();
  }

  // ── Run ──────────────────────────────────────
  async function run() {
    const input = document.getElementById('sql-input');
    const query = input.value.trim();
    if (!query) return;

    const btn = document.getElementById('run-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Ejecutando…';

    document.getElementById('sql-results').innerHTML =
      '<div style="padding:20px;color:var(--text3);font-size:13px">Ejecutando consulta…</div>';

    const res = await API.runQuery(query);
    renderResult(res);
    addToHistory(query);

    btn.disabled = false;
    btn.textContent = '▶ Ejecutar';
  }

  // ── Render result ────────────────────────────
  function renderResult(res) {
    const cont = document.getElementById('sql-results');

    if (!res.success) {
      cont.innerHTML = `<div class="result-status error">❌ ${UI.escapeHTML(res.error)}</div>`;
      return;
    }

    if (!res.isSelect) {
      cont.innerHTML = `<div class="result-status success">✅ Consulta ejecutada — ${res.affectedRows ?? 0} fila(s) afectada(s)</div>`;
      return;
    }

    if (res.rows.length === 0) {
      cont.innerHTML = `<div class="result-status info">✅ Consulta OK — 0 filas devueltas</div>`;
      return;
    }

    const cols = Object.keys(res.rows[0]);
    let html = `<div class="result-status success">✅ ${res.rows.length} fila(s) — ${cols.length} columna(s)</div>`;
    html += `<div style="overflow-x:auto">`;
    html += `<table class="data-table"><thead><tr>`;
    cols.forEach(c => html += `<th>${UI.escapeHTML(c)}</th>`);
    html += `</tr></thead><tbody>`;
    res.rows.forEach(row => {
      html += `<tr>`;
      cols.forEach(c => {
        const val = row[c];
        html += `<td>${val !== null && val !== undefined ? UI.escapeHTML(String(val)) : '<span style="color:var(--text3)">NULL</span>'}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    cont.innerHTML = html;
  }

  // ── History ──────────────────────────────────
  function addToHistory(query) {
    history.unshift(query);
    if (history.length > MAX_HISTORY) history.pop();
    renderHistory();
  }

  function renderHistory() {
    const cont = document.getElementById('sql-history');
    if (!history.length) {
      cont.innerHTML = '<div class="no-history">Sin historial aún</div>';
      return;
    }
    cont.innerHTML = history.map((q, i) => `
      <div class="history-item" data-idx="${i}" title="${UI.escapeHTML(q)}">
        ${UI.escapeHTML(q.substring(0, 70))}${q.length > 70 ? '…' : ''}
      </div>
    `).join('');
    cont.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => setQuery(history[parseInt(el.dataset.idx)]));
    });
  }

  // ── Examples ─────────────────────────────────
  function renderExamples() {
    const cont = document.getElementById('example-queries');
    cont.innerHTML = EXAMPLE_QUERIES.map((q, i) => `
      <div class="example-item" data-idx="${i}">${UI.escapeHTML(q.split('\n')[0])}${q.includes('\n') ? '…' : ''}</div>
    `).join('');
    cont.querySelectorAll('.example-item').forEach(el => {
      el.addEventListener('click', () => setQuery(EXAMPLE_QUERIES[parseInt(el.dataset.idx)]));
    });
  }

  return { init, setQuery, run };
})();
