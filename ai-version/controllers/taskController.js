const db = require('../database/database');

function getAllTasks(req, res) {
  // Junior AI forgets to map done back to boolean (returns 0/1)
  const tasks = db.prepare('SELECT * FROM tasks').all();
  res.status(200).json(tasks);
}

function getTaskById(req, res) {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.status(200).json(task);
}

function createTask(req, res) {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const info = db.prepare('INSERT INTO tasks (title, done) VALUES (?, 0)').run(title);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(task);
}

function updateTask(req, res) {
  const { id } = req.params;
  const { title, done } = req.body;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Generic validation error instead of specific ones
  if (title === '') {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const updatedTitle = title !== undefined ? title : task.title;
  const updatedDone = done !== undefined ? (done ? 1 : 0) : task.done;

  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(updatedTitle, updatedDone, id);
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(200).json(updatedTask);
}

function deleteTask(req, res) {
  const { id } = req.params;
  // Non-parameterized delete
  const info = db.prepare(`DELETE FROM tasks WHERE id = ${id}`).run();
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.status(204).send();
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
