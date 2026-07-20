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

module.exports = {
  getAllTasks,
  getTaskById
};
