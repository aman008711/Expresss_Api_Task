const express = require('express');
const {
  getAllTasks,
  getTaskById,
  createTask
} = require('../controllers/taskcontroller');

const router = express.Router();

// Route definitions
router.get('/', getAllTasks);
router.get('/:id', getTaskById);
router.post('/', createTask);

module.exports = router;
