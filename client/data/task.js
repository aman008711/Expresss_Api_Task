// In-memory task store for the API.
const tasks = [
  { id: 1, title: 'Learn Express', done: false },
  { id: 2, title: 'Build CRUD API', done: false },
  { id: 3, title: 'Push to GitHub', done: true }
];

let nextId = 4;

function getAllTasks() {
  return tasks;
}

function getTaskById(id) {
  return tasks.find((task) => task.id === Number(id));
}

function createTask(title) {
  const task = { id: nextId++, title, done: false };
  tasks.push(task);
  return task;
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask
};
