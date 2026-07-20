const express = require('express');
const {
  getAllTasks,
  getTaskById
} = require('../controllers/taskcontroller');

const router = express.Router();

// Route definitions
router.get('/', getAllTasks);
router.get('/:id', getTaskById);

module.exports = router;
