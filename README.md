# Task Management CRUD API

A modular RESTful API for managing tasks with Node.js, Express, and Swagger UI.

## Features
- In-memory task storage only (no database)
- CRUD endpoints for tasks
- Swagger documentation at `/docs`
- Health check endpoint at `/health`
- Clean modular architecture with separate routes, controllers, middleware, and data layers

## Project Structure
```text
client/
  controllers/
  data/
  middleware/
  routes/
  swagger/
server.js
package.json
README.md
```

## Installation
```bash
npm install
```

## Run the Server
```bash
npm start
```

The server will start on port `3000` by default. If that port is already in use, it will automatically try the next available port.

## Available Endpoints
- `GET /` → API information
- `GET /health` → Health check
- `GET /tasks` → Get all tasks
- `GET /tasks/:id` → Get one task
- `POST /tasks` → Create a task
- `PUT /tasks/:id` → Update a task
- `DELETE /tasks/:id` → Delete a task
- `GET /docs` → Swagger UI

## Example Request
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy Milk"}'
```

## Testing with Postman or curl
You can test the API using Postman or the terminal.

### Example: Create a task
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy Milk"}'
```

### Example: Get all tasks
```bash
curl http://localhost:3000/tasks
```

## Notes
- Tasks are stored only in memory and reset when the server restarts.
- Validation ensures that task titles are required and cannot be empty.
