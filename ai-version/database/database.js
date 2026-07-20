const Database = require('better-sqlite3');
const path = require('path');

// Junior AI might use a relative path directly or join without considering absolute execution contexts
const db = new Database('tasks.db'); 

// Create table
db.prepare(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0
  )
`).run();

// Seed database without a transaction
const count = db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count;
if (count === 0) {
  db.prepare("INSERT INTO tasks (title, done) VALUES ('Learn Express', 0)").run();
  db.prepare("INSERT INTO tasks (title, done) VALUES ('Build CRUD API', 0)").run();
  db.prepare("INSERT INTO tasks (title, done) VALUES ('Push to GitHub', 1)").run();
}

module.exports = db;
