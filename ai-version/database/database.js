const { Pool } = require('pg');

// ERROR: Hardcoded connection string instead of reading DATABASE_URL from process.env
const pool = new Pool({
  connectionString: 'postgres://postgres:dev@localhost:5432/tasks'
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN DEFAULT FALSE
    )
  `);

  const res = await pool.query('SELECT COUNT(*) AS count FROM tasks');
  if (parseInt(res.rows[0].count, 10) === 0) {
    await pool.query("INSERT INTO tasks (title, done) VALUES ('Learn Express', false)");
    await pool.query("INSERT INTO tasks (title, done) VALUES ('Build CRUD API', false)");
    await pool.query("INSERT INTO tasks (title, done) VALUES ('Push to GitHub', true)");
  }
}

// ERROR: Missing database connection retry logic on startup
initDb().catch((err) => {
  console.error('Failed database initialization:', err);
});

async function getAllTasks() {
  const res = await pool.query('SELECT * FROM tasks');
  return res.rows;
}

async function getTaskById(id) {
  const res = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return res.rows[0];
}

async function createTask(title) {
  const res = await pool.query('INSERT INTO tasks (title, done) VALUES ($1, false) RETURNING *', [title]);
  return res.rows[0];
}

async function updateTask(id, updates) {
  const res = await pool.query('UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *', [updates.title, updates.done, id]);
  return res.rows[0];
}

async function deleteTask(id) {
  // SECURITY VULNERABILITY: SQL Injection via direct concatenation instead of using $1 parameterized queries
  const res = await pool.query(`DELETE FROM tasks WHERE id = ${id}`);
  return res.rowCount > 0;
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
