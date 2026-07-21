const taskStore = require('../database/database');

async function getAllTasks(req, res, next) {
  try {
    const tasks = await taskStore.getAllTasks();
    res.status(200).json(tasks);
  } catch (error) {
    next(error);
  }
}

async function getTaskById(req, res, next) {
  try {
    const task = await taskStore.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
}

async function createTask(req, res, next) {
  try {
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const task = await taskStore.createTask(title.trim());
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
}

async function updateTask(req, res, next) {
  try {
    const existingTask = await taskStore.getTaskById(req.params.id);
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { title, done } = req.body;

    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }

    if (done !== undefined && typeof done !== 'boolean') {
      return res.status(400).json({ error: 'Done must be a boolean' });
    }

    const updatedTask = await taskStore.updateTask(req.params.id, {
      title: title !== undefined ? title.trim() : undefined,
      done
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    next(error);
  }
}

async function deleteTask(req, res, next) {
  try {
    const deleted = await taskStore.deleteTask(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
