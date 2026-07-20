const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'tasks.db');
const db = new Database(dbPath);

// Create the tasks table if it does not exist.
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0
  )
`);

// Seed the database only once.
const countRow = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
if (countRow.count === 0) {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const seedTasks = [
    { title: 'Learn Express', done: 0 },
    { title: 'Build CRUD API', done: 0 },
    { title: 'Push to GitHub', done: 1 }
  ];

  const insertTransaction = db.transaction((tasks) => {
    for (const task of tasks) {
      insert.run(task.title, task.done);
    }
  });

  insertTransaction(seedTasks);
}

function mapTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    done: row.done === 1
  };
}

function getAllTasks() {
  const rows = db.prepare('SELECT id, title, done FROM tasks').all();
  return rows.map(mapTask);
}

function getTaskById(id) {
  const row = db.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(Number(id));
  return mapTask(row);
}

function createTask(title) {
  const result = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)').run(title, 0);
  return getTaskById(result.lastInsertRowid);
}

function updateTask(id, updates) {
  const task = getTaskById(id);
  if (!task) {
    return null;
  }

  const updatedTitle = updates.title !== undefined ? updates.title : task.title;
  const updatedDone = updates.done !== undefined ? (updates.done ? 1 : 0) : (task.done ? 1 : 0);

  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(updatedTitle, updatedDone, Number(id));
  return getTaskById(id);
}

function deleteTask(id) {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(Number(id));
  return result.changes > 0;
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
