/* ════════════════════════════════════════════
   dashboard.js — Dashboard estadístico
════════════════════════════════════════════ */

const Dashboard = (() => {
  const GLOW_COLORS = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', 'var(--warn)', '#ec4899'];
  const ICONS = {
    Participantes: '👤',
    Equipo:        '🏆',
    Racking:       '🥇',
    Problemas:     '🧩',
    Fechas:        '📅',
  };

  async function init() {
    const statsGrid = document.getElementById('stats-grid');
    const dashExtra = document.getElementById('dash-queries');

    statsGrid.innerHTML = UI.spinner('Cargando estadísticas…');

    const res = await API.getStats();
    if (!res.success) {
      statsGrid.innerHTML = `<div style="color:var(--danger)">❌ ${res.error}</div>`;
      return;
    }

    const { counts, tables } = res;

    // ── Stat cards ────────────────────────────
    statsGrid.innerHTML = tables.map((name, i) => `
      <div class="stat-card" style="--glow-color:${GLOW_COLORS[i % GLOW_COLORS.length]}">
        <div class="stat-label">${ICONS[name] || '🗄️'} ${name}</div>
        <div class="stat-value">${counts[name] ?? 0}</div>
        <div class="stat-sub">registros</div>
      </div>
    `).join('');

    // ── Quick data panels ─────────────────────
    const quickQueries = [
      {
        title: '🥇 Ranking por Puntaje',
        sql:   'SELECT r.Posicion, e.Nombre AS Equipo, r.Puntaje FROM Racking r JOIN Equipo e ON r.id_equipo = e.id_equipo ORDER BY r.Posicion LIMIT 10',
      },
      {
        title: '📅 Fechas de competencia',
        sql:   'SELECT Fecha, Tipo_ronda FROM Fechas ORDER BY Fecha',
      },
    ];

    const results = await Promise.all(
      quickQueries.map(q => API.runQuery(q.sql))
    );

    dashExtra.innerHTML = quickQueries.map((q, i) => {
      const res = results[i];
      if (!res.success || !res.rows.length) {
        return `
          <div class="dash-card">
            <div class="dash-card-title">${q.title}</div>
            <div style="color:var(--text3);font-size:13px">Sin datos</div>
          </div>
        `;
      }
      const cols = Object.keys(res.rows[0]);
      const tableHTML = `
        <table class="data-table">
          <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>
            ${res.rows.map(row =>
              `<tr>${cols.map(c => {
                const v = row[c];
                return `<td>${v !== null && v !== undefined ? v : '<span style="color:var(--text3)">NULL</span>'}</td>`;
              }).join('')}</tr>`
            ).join('')}
          </tbody>
        </table>
      `;
      return `
        <div class="dash-card">
          <div class="dash-card-title">${q.title}</div>
          <div class="data-table-wrap" style="border-radius:8px">${tableHTML}</div>
        </div>
      `;
    }).join('');
  }

  return { init };
})();
