/* ════════════════════════════════════════════
   app.js — Controlador principal
   Login, logout, navegación entre paneles.
════════════════════════════════════════════ */

let appRole         = 'admin';
let appPassword     = '';
let schemaLoaded    = false;
let dashboardLoaded = false;
let manageLoaded    = false;
let registerLoaded  = false;

const PASSWORDS = { admin: 'admin123', user: 'user123' };

// ════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    appRole = btn.dataset.role;
    document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});

document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('app-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

async function doLogin() {
  const host = document.getElementById('api-host').value.trim() || 'localhost';
  const port = document.getElementById('api-port').value.trim() || '3001';
  const pass = document.getElementById('app-pass').value;
  const errEl = document.getElementById('login-error');

  errEl.textContent = '';

  if (PASSWORDS[appRole] !== pass) {
    errEl.textContent = '❌ Contraseña incorrecta para el rol seleccionado';
    return;
  }

  errEl.textContent = 'Conectando al backend…';

  // Configurar API
  API.configure(host, port, appRole, pass);
  appPassword = pass;

  // Health check
  const health = await API.health();
  if (!health.status) {
    errEl.textContent = `❌ No se pudo conectar al backend en ${host}:${port}`;
    return;
  }

  // Mostrar app
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');

  document.getElementById('header-db-name').innerHTML = `<span>${health.db || 'icpc'}</span>`;
  document.getElementById('conn-info').textContent = `${appRole}@${host}:${port}`;

  const badge = document.getElementById('role-badge');
  badge.className = `role-badge ${appRole}`;
  badge.textContent = appRole === 'admin' ? '🔐 Admin' : '👤 Usuario';

  // Mostrar pestaña "Gestionar" solo para admin
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', appRole !== 'admin');
  });

  // Resetear flags
  schemaLoaded = dashboardLoaded = manageLoaded = registerLoaded = false;

  // Inicializar módulos base
  await Tables.init(appRole);
}

// ════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════
document.getElementById('logout-btn').addEventListener('click', () => {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').classList.add('hidden');
  document.getElementById('app-pass').value = '';
  document.getElementById('login-error').textContent = '';
  document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  UI.switchTab('tables');
  schemaLoaded = dashboardLoaded = manageLoaded = registerLoaded = false;
});

// ════════════════════════════════════════════
// NAVEGACIÓN POR TABS
// ════════════════════════════════════════════
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const panel = btn.dataset.panel;
    UI.switchTab(panel);

    if (panel === 'register' && !registerLoaded) {
      registerLoaded = true;
      await Register.init();
    }
    if (panel === 'manage' && !manageLoaded && appRole === 'admin') {
      manageLoaded = true;
      await Manage.init();
    }
    if (panel === 'schema' && !schemaLoaded) {
      schemaLoaded = true;
      await Schema.init();
    }
    if (panel === 'dashboard' && !dashboardLoaded) {
      dashboardLoaded = true;
      await Dashboard.init();
    }
  });
});

// ════════════════════════════════════════════
// SEARCH (debounce)
// ════════════════════════════════════════════
let searchTimer = null;
document.getElementById('search-box').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => Tables.onSearch(e.target.value.trim()), 350);
});

// ════════════════════════════════════════════
// PAGINACIÓN
// ════════════════════════════════════════════
document.getElementById('pg-prev').addEventListener('click', () => Tables.changePage(-1));
document.getElementById('pg-next').addEventListener('click', () => Tables.changePage(+1));

// ════════════════════════════════════════════
// MODAL
// ════════════════════════════════════════════
document.getElementById('modal-save').addEventListener('click',   () => UI.triggerModalSave());
document.getElementById('modal-cancel').addEventListener('click', () => UI.closeModal());
document.getElementById('modal-close').addEventListener('click',  () => UI.closeModal());
document.getElementById('modal').addEventListener('click', e => {
  if (e.target === document.getElementById('modal')) UI.closeModal();
});
