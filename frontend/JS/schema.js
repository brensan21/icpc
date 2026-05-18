/* ════════════════════════════════════════════
   schema.js — Vista de esquema de la BD
════════════════════════════════════════════ */

const Schema = (() => {

  const TABLE_ICONS = {
    Participantes: '👤',
    Equipo:        '🏆',
    Racking:       '🥇',
    Problemas:     '🧩',
    Fechas:        '📅',
  };

  async function init() {
    const cont = document.getElementById('schema-grid');

    const res = await API.getTables();
    if (!res.success) {
      cont.innerHTML = `<div style="color:var(--danger)">❌ ${res.error}</div>`;
      return;
    }

    // Cargar DESCRIBE de todas las tablas en paralelo
    const schemas = await Promise.all(
      res.tables.map(async name => {
        const r = await API.getSchema(name);
        return { name, fields: r.success ? r.fields : [] };
      })
    );

    cont.innerHTML = schemas.map(({ name, fields }) => {
      const icon = TABLE_ICONS[name] || '🗄️';
      const fieldsHTML = fields.map(f => {
        const keyIcon = f.Key === 'PRI' ? '🔑 ' : f.Key === 'MUL' ? '🔗 ' : '';
        const nullable = f.Null === 'YES' ? '<span style="color:var(--text3);font-size:10px"> NULL</span>' : '';
        return `
          <div class="schema-field">
            <span class="schema-field-name">${keyIcon}${f.Field}${nullable}</span>
            <span class="schema-field-type">${f.Type}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="schema-card">
          <div class="schema-card-header">
            <span>${icon}</span>
            <div class="schema-table-name">${name}</div>
            <span style="font-size:11px;color:var(--text3);margin-left:auto">${fields.length} campos</span>
          </div>
          <div class="schema-fields">${fieldsHTML || '<div style="color:var(--text3);font-size:12px">Sin campos</div>'}</div>
        </div>
      `;
    }).join('');
  }

  return { init };
})();
