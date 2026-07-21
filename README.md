# Task Management API with PostgreSQL

A modular, production-ready RESTful API for managing tasks built with Node.js, Express, and PostgreSQL, fully containerized using Docker and Docker Compose.

## Goal & Purpose
This application runs against a containerized PostgreSQL database. Both the API service and database are orchestrated via a single command using Docker Compose. Database secrets are loaded from a git-ignored `.env` file for secure environment management.

## Getting Started

### Prerequisites
- Docker Desktop or Podman installed and running.

### Configuration
1. Clone the repository.
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. The `.env` file contains the connection string:
   ```env
   DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks
   ```
   *(Note: Inside the Docker network, the API container resolves the database host dynamically using the service name `db` instead of `localhost`).*

### Run the Stack
Start the database and the API container with one command:
```bash
docker compose up --build -d
```
The API will start and serve requests at `http://localhost:3000`.

### Seed Data & Schema Auto-creation
On startup, the system automatically checks if the `tasks` table exists. If it's missing:
1. It creates the table (`id SERIAL PRIMARY KEY`, `title TEXT NOT NULL`, `done BOOLEAN DEFAULT FALSE`).
2. It seeds the database with exactly three default tasks only if the table is empty.

---

## API Endpoints

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| GET | `/` | Root details (API info, database type) | `200` |
| GET | `/health` | Live system and database health check | `200`, `500` |
| GET | `/tasks` | Retrieve all tasks | `200` |
| GET | `/tasks/:id` | Retrieve a single task by ID | `200`, `404` |
| POST | `/tasks` | Create a new task (body: `{"title": "..."}`) | `201`, `400` |
| PUT | `/tasks/:id` | Update task title/done (body: `{"title": "...", "done": true}`) | `200`, `400`, `404` |
| DELETE | `/tasks/:id` | Delete a task | `204`, `404` |
| GET | `/docs` | Swagger UI documentation | `200` |

---

## Database Screenshot
Below is the database table structure and tasks viewed in the GUI Database Client:

![Postgres DB Screenshot](db_postgres_screenshot.png)

---

## Verification & Curl Output

Example request to retrieve all tasks:
```bash
curl -i http://localhost:3000/tasks
```

**Pasted curl Output:**
```http
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 140
ETag: W/"8c-S247R5UkbRFF/TzVIoFNuO4FQoU"
Date: Tue, 21 Jul 2026 05:10:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

[
  {"id":1,"title":"Learn Express","done":false},
  {"id":2,"title":"Build CRUD API","done":false},
  {"id":3,"title":"Push to GitHub","done":true}
]
```
