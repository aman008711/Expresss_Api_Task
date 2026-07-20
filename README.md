# Task Management API with SQLite

A modular RESTful API for managing tasks built with Node.js, Express, and SQLite.

## Why SQLite?
SQLite was chosen for this project because:
- **Zero Configuration**: It requires no external server setup, install, or administrative overhead.
- **Single File Persistence**: The entire database lives in a single file on disk, which makes it simple to manage and backup.
- **Restart Resilience**: Unlike in-memory arrays, our tasks are saved to disk, ensuring data survives when the server restarts.

## Database Location
The database is located at `database/tasks.db`. This file is git-ignored, meaning that every fresh clone of the project starts with a clean database.

On startup, the system automatically:
1. Creates the database file `database/tasks.db` if it is missing.
2. Creates the `tasks` table with schema:
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `title`: TEXT NOT NULL
   - `done`: INTEGER DEFAULT 0
3. Seeds the database with exactly three tasks if the table is empty (preventing duplicate seeds on subsequent restarts).

## DB Browser Screenshot
Below is the database table structure and seeded tasks viewed in DB Browser for SQLite:

![DB Browser Screenshot](db_browser_screenshot.png)

## Example SQL Query (Stage 4)
During hand exploration, the following query was executed to fetch only completed tasks:

```sql
SELECT * FROM tasks WHERE done = 1;
```

**Returned Result:**
```json
[
  { "id": 3, "title": "Push to GitHub", "done": 1 }
]
```

---

## Project Structure
```text
database/
  database.js
controllers/
  taskController.js
routes/
  taskRoutes.js
middleware/
  errorHandler.js
swagger/
  openapi.json
server.js
package.json
README.md
.gitignore
```

## Installation
```bash
npm install
```

## Run the Server
```bash
npm start
```
The server runs on port `3000` by default. If port `3000` is busy, it automatically attempts the next available port.

## API Endpoints
- `GET /` → API information (version, DB type)
- `GET /health` → Health check
- `GET /tasks` → Get all tasks from SQLite
- `GET /tasks/:id` → Get a single task from SQLite
- `POST /tasks` → Create a new task in SQLite
- `PUT /tasks/:id` → Update a task in SQLite
- `DELETE /tasks/:id` → Delete a task from SQLite
- `GET /docs` → Swagger UI documentation

## Testing the API
You can run the API locally and query it using `curl` or Postman.

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

---

## AI vs Me Rematch

### The Prompt
```text
Write a Node.js task management API module using Express and better-sqlite3.
Create/initialize database/tasks.db and tasks table if they are missing.
The table should have columns: id (INTEGER PRIMARY KEY AUTOINCREMENT), title (TEXT NOT NULL), done (INTEGER DEFAULT 0).
Seed three tasks ('Learn Express', 'Build CRUD API', 'Push to GitHub') ONLY if the table is empty.
Implement five REST CRUD endpoints (/tasks, /tasks/:id, POST /tasks, PUT /tasks/:id, DELETE /tasks/:id) maintaining the exact modular controllers and routes structure, returning correct status codes (200, 201, 204, 400, 404), converting database 'done' (0/1) to true/false in JSON responses, and using parameterized queries to prevent SQL injection.
```

### Questions & Comparison

#### 1. What did it do better?
The AI version of `taskController` was more compact as it directly prepared and ran SQLite statements within the controller, eliminating a layer of abstraction. However, this is actually a design anti-pattern as it couples the HTTP controller directly to the SQLite dialect. My hand-written version is better because it abstracts the database operations inside the `database/database.js` store module, making it easy to swap SQLite for Postgres or MongoDB in the future without changing a single line of controller code. My seeding code also wrapped insertions in an SQL transaction (`db.transaction`), which ensures atomic, high-performance seed runs.

#### 2. What did it get wrong or quietly ignore?
- **Security Vulnerability (SQL Injection)**: The AI wrote `db.prepare(\`DELETE FROM tasks WHERE id = \${id}\`).run()` in `deleteTask`, gluing the user input directly into the query instead of using `db.prepare('DELETE FROM tasks WHERE id = ?').run(id)`.
- **Response Shape Breakage**: It forgot to map the `done` field (stored as `0`/`1` in SQLite) back to boolean (`true`/`false`) in the JSON output, returning `done: 0` or `done: 1` directly, which violates the contract from A1.
- **Incorrect Validations**: It ignored specific validation checks from A1 (e.g. checking if `done` is boolean, and returning specialized error messages like "Title cannot be empty").

#### 3. What did the prompt forget to specify, and what did the AI silently decide?
The prompt forgot to specify:
- That the controller should remain decoupled from the database module. The AI silently decided to perform raw SQLite database calls inside the controller.
- The exact error messages to return on validation failures. The AI invented a generic `{"error": "Invalid input"}` body.

---

### The Rematch
**Improved Prompt:**
> "Rewrite the Express controllers using the existing decoupled pattern: all database queries must be encapsulated inside `database/database.js`. In the controller, validate inputs exactly matching A1 rules: return status 400 with 'Title cannot be empty' if the update title is empty, and 'Done must be a boolean' if done is not a boolean. In the database module, ensure all results convert the integer 1/0 'done' column to boolean true/false. Use parameterized queries for all database operations including deletion to prevent SQL injection."

**Outcome change**: In the rematch, the AI correctly encapsulated query logic within the database module, used parameterized placeholders for the DELETE route to eliminate the SQL injection bug, and outputted the exact A1 validation error messages.
