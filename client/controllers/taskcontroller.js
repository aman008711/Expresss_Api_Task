const taskStore = require('../data/task');

// Return all tasks.
function getAllTasks(req, res) {
  res.status(200).json(taskStore.getAllTasks());
}

// Return a single task by id.
function getTaskById(req, res) {
  const task = taskStore.getTaskById(req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  return res.status(200).json(task);
}

// Create a new task.
function createTask(req, res) {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  const task = taskStore.createTask(title.trim());
  return res.status(201).json(task);
}

// Update an existing task.
function updateTask(req, res) {
  const task = taskStore.getTaskById(req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { title, done } = req.body;

  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }

  if (done !== undefined && typeof done !== 'boolean') {
    return res.status(400).json({ error: 'Done must be a boolean' });
  }

  const updatedTask = taskStore.updateTask(req.params.id, {
    title: title !== undefined ? title.trim() : undefined,
    done
  });

  return res.status(200).json(updatedTask);
}

// Delete a task.
function deleteTask(req, res) {
  const deleted = taskStore.deleteTask(req.params.id);

  if (!deleted) {
    return res.status(404).json({ error: 'Task not found' });
  }

  return res.status(204).send();
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
