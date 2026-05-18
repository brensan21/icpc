/* ════════════════════════════════════════════
   api.js — Comunicación con el backend
   Todas las peticiones HTTP van aquí.
════════════════════════════════════════════ */

const API = (() => {
  let baseURL = 'http://localhost:3001';
  let role     = 'user';
  let password = '';

  // ── Configura la conexión ───────────────────
  function configure(host, port, r, pass) {
    baseURL  = `http://${host}:${port}`;
    role     = r;
    password = pass;
  }

  // ── Headers comunes ─────────────────────────
  function headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'role':     role,
      'password': password,
      ...extra,
    };
  }

  // ── Fetch wrapper ───────────────────────────
  async function request(method, path, body = null) {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(baseURL + path, opts);
      return await res.json();
    } catch (err) {
      return { success: false, error: `No se pudo conectar al backend (${err.message})` };
    }
  }

  // ── Endpoints ───────────────────────────────

  /** Verifica que el backend esté vivo */
  function health() {
    return request('GET', '/health');
  }

  /** Lista de tablas */
  function getTables() {
    return request('GET', '/tables');
  }

  /** Esquema (DESCRIBE) de una tabla */
  function getSchema(tableName) {
    return request('GET', `/tables/${encodeURIComponent(tableName)}/schema`);
  }

  /** Filas de una tabla con paginación y búsqueda */
  function getRows(tableName, { limit = 50, offset = 0, search = '' } = {}) {
    const qs = new URLSearchParams({ limit, offset, search }).toString();
    return request('GET', `/tables/${encodeURIComponent(tableName)}/rows?${qs}`);
  }

  /** Insertar una fila */
  function insertRow(tableName, data) {
    return request('POST', `/tables/${encodeURIComponent(tableName)}/rows`, data);
  }

  /** Actualizar una fila por PK */
  function updateRow(tableName, pkField, pkValue, data) {
    return request(
      'PUT',
      `/tables/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(pkField)}/${encodeURIComponent(pkValue)}`,
      data
    );
  }

  /** Eliminar una fila por PK */
  function deleteRow(tableName, pkField, pkValue) {
    return request(
      'DELETE',
      `/tables/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(pkField)}/${encodeURIComponent(pkValue)}`
    );
  }

  /** Ejecutar SQL libre */
  function runQuery(sql) {
    return request('POST', '/query', { sql });
  }

  /** Estadísticas del dashboard */
  function getStats() {
    return request('GET', '/stats');
  }

  return { configure, health, getTables, getSchema, getRows, insertRow, updateRow, deleteRow, runQuery, getStats };
})();
