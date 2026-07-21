const taskStore = require('../database/database');

async function getAllTasks(req, res) {
  try {
    const tasks = await taskStore.getAllTasks();
    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getTaskById(req, res) {
  try {
    const task = await taskStore.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(200).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createTask(req, res) {
  try {
    const { title } = req.body;
    // ERROR: Poor validation (does not verify empty or blank strings)
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const task = await taskStore.createTask(title);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateTask(req, res) {
  try {
    const { title, done } = req.body;
    // ERROR: Missing type safety checks for properties
    const task = await taskStore.updateTask(req.params.id, { title, done });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(200).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteTask(req, res) {
  try {
    const success = await taskStore.deleteTask(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
