const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initDb() {
  // Create tasks table if it does not exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN DEFAULT FALSE
    )
  `);

  // Seed default tasks if empty
  const res = await pool.query('SELECT COUNT(*) AS count FROM tasks');
  const count = parseInt(res.rows[0].count, 10);
  if (count === 0) {
    const seedTasks = [
      { title: 'Learn Express', done: false },
      { title: 'Build CRUD API', done: false },
      { title: 'Push to GitHub', done: true }
    ];

    for (const task of seedTasks) {
      await pool.query(
        'INSERT INTO tasks (title, done) VALUES ($1, $2)',
        [task.title, task.done]
      );
    }
    console.log('Seeded tasks table with example data.');
  }
}

// Automatically initialize database
initDb().catch((err) => {
  console.error('Failed to initialize PostgreSQL database:', err);
});

function mapTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    done: !!row.done
  };
}

async function getAllTasks() {
  const result = await pool.query('SELECT id, title, done FROM tasks ORDER BY id ASC');
  return result.rows.map(mapTask);
}

async function getTaskById(id) {
  const result = await pool.query('SELECT id, title, done FROM tasks WHERE id = $1', [Number(id)]);
  if (result.rows.length === 0) return null;
  return mapTask(result.rows[0]);
}

async function createTask(title) {
  const result = await pool.query(
    'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *',
    [title, false]
  );
  return mapTask(result.rows[0]);
}

async function updateTask(id, updates) {
  const task = await getTaskById(id);
  if (!task) return null;

  const updatedTitle = updates.title !== undefined ? updates.title : task.title;
  const updatedDone = updates.done !== undefined ? updates.done : task.done;

  const result = await pool.query(
    'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *',
    [updatedTitle, updatedDone, Number(id)]
  );
  return mapTask(result.rows[0]);
}

async function deleteTask(id) {
  const result = await pool.query('DELETE FROM tasks WHERE id = $1', [Number(id)]);
  return result.rowCount > 0;
}

module.exports = {
  pool,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
