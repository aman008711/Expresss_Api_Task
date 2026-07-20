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

module.exports = db;
