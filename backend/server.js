const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── Configuración de conexión a MySQL ───────────────────────────────────────
const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '123456',       
  database: process.env.DB_NAME     || 'icpc',
  waitForConnections: true,
  connectionLimit: 10,
};

let pool;

async function initPool() {
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log(`✅ Conectado a MySQL → ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    conn.release();
  } catch (err) {
    console.error('❌ Error conectando a MySQL:', err.message);
    process.exit(1);
  }
}

// ─── Middleware de autenticación básica ──────────────────────────────────────
const CREDENTIALS = {
  admin: 'admin123',
  user:  'user123',
};

function authMiddleware(req, res, next) {
  const { role, password } = req.headers;
  if (!role || !password || CREDENTIALS[role] !== password) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }
  req.userRole = role;
  next();
}

// ─── Comandos de escritura bloqueados para usuarios ──────────────────────────
const WRITE_COMMANDS = /^\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|RENAME|REPLACE)/i;

// ─── RUTAS ───────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: dbConfig.database });
});

// Lista de tablas
app.get('/tables', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SHOW TABLES');
    const key = Object.keys(rows[0])[0];
    const tables = rows.map(r => r[key]);
    res.json({ success: true, tables });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Describe estructura de una tabla
app.get('/tables/:name/schema', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(`DESCRIBE \`${req.params.name}\``);
    res.json({ success: true, fields: rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Datos de una tabla (con paginación y búsqueda)
app.get('/tables/:name/rows', authMiddleware, async (req, res) => {
  const { name } = req.params;
  const limit  = parseInt(req.query.limit)  || 50;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';

  try {
    const [countRows] = await pool.execute(`SELECT COUNT(*) as total FROM \`${name}\``);
    const total = countRows[0].total;

    let sql = `SELECT * FROM \`${name}\``;
    const params = [];

    if (search) {
      // Obtener columnas para buscar en todas
      const [cols] = await pool.execute(`DESCRIBE \`${name}\``);
      const conditions = cols.map(c => `\`${c.Field}\` LIKE ?`).join(' OR ');
      const values = cols.map(() => `%${search}%`);
      sql += ` WHERE ${conditions}`;
      params.push(...values);
    }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, rows, total });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Insertar fila
app.post('/tables/:name/rows', authMiddleware, async (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ success: false, error: 'Solo el administrador puede insertar registros.' });
  const { name } = req.params;
  const data = req.body;
  const cols = Object.keys(data).map(c => `\`${c}\``).join(', ');
  const placeholders = Object.keys(data).map(() => '?').join(', ');
  const values = Object.values(data);
  try {
    const [result] = await pool.execute(`INSERT INTO \`${name}\` (${cols}) VALUES (${placeholders})`, values);
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Actualizar fila (por PK)
app.put('/tables/:name/rows/:pk/:id', authMiddleware, async (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ success: false, error: 'Solo el administrador puede editar registros.' });
  const { name, pk, id } = req.params;
  const data = req.body;
  const sets = Object.keys(data).map(c => `\`${c}\` = ?`).join(', ');
  const values = [...Object.values(data), id];
  try {
    await pool.execute(`UPDATE \`${name}\` SET ${sets} WHERE \`${pk}\` = ?`, values);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Eliminar fila (por PK)
app.delete('/tables/:name/rows/:pk/:id', authMiddleware, async (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ success: false, error: 'Solo el administrador puede eliminar registros.' });
  const { name, pk, id } = req.params;
  try {
    await pool.execute(`DELETE FROM \`${name}\` WHERE \`${pk}\` = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Ejecutar SQL libre
app.post('/query', authMiddleware, async (req, res) => {
  const { sql } = req.body;
  if (!sql || !sql.trim()) return res.json({ success: false, error: 'Query vacío.' });

  if (req.userRole !== 'admin' && WRITE_COMMANDS.test(sql)) {
    return res.status(403).json({ success: false, error: 'Permiso denegado: solo el Administrador puede ejecutar comandos de escritura.' });
  }

  try {
    const [rows, fields] = await pool.execute(sql);
    const isSelect = Array.isArray(rows);
    res.json({
      success: true,
      rows: isSelect ? rows : [],
      affectedRows: !isSelect ? rows.affectedRows : undefined,
      isSelect
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Estadísticas generales para el dashboard
app.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [tables] = await pool.execute('SHOW TABLES');
    const key = Object.keys(tables[0])[0];
    const tableNames = tables.map(r => r[key]);

    const counts = {};
    for (const t of tableNames) {
      const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM \`${t}\``);
      counts[t] = total;
    }

    res.json({ success: true, counts, tables: tableNames });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
initPool().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`   Base de datos: ${dbConfig.database}`);
    console.log(`   Roles: admin (admin123) | usuario (user123)`);
  });
});
