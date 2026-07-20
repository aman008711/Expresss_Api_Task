const taskStore = require('../database/database');

function getAllTasks(req, res) {
  res.status(200).json(taskStore.getAllTasks());
}

function getTaskById(req, res) {
  const task = taskStore.getTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.status(200).json(task);
}

function createTask(req, res) {
  res.status(501).json({ error: 'Not implemented yet' });
}

function updateTask(req, res) {
  res.status(501).json({ error: 'Not implemented yet' });
}

function deleteTask(req, res) {
  res.status(501).json({ error: 'Not implemented yet' });
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
