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

---

## Stage 6: The AI Rematch (PostgreSQL Migration Edition)

### The Prompt
> "Write a multi-container Docker Compose configuration for my Node.js Express task CRUD API. I'm using the 'pg' library with PostgreSQL. The database needs a persistent volume and has password 'dev' and database 'tasks'. The API and database should boot with a single command. The DB credentials must come from environment variables. Ensure the tasks table schema is created automatically on start (id serial primary key, title text, done boolean) and seeded with 3 tasks ('Learn Express', 'Build CRUD API', 'Push to GitHub') ONLY if the table is empty. Implement parameterized queries for all endpoints."

### Run & Diff Comparison

We quarantined the AI's version in [ai-version/](file:///c:/Users/amnk3/First%20Crud%20Api/ai-version) and compared it to our hand-built version using `git diff --no-index`.

#### 1. What did our hand-built version do better?
- **Docker Compose Networking**: Our `compose.yaml` correctly used the database service name `db` inside the `DATABASE_URL` environment variable (`postgres://postgres:dev@db:5432/tasks`). The AI used `localhost:5432`, which works for local host machine runs but causes an immediate crash (`ECONNREFUSED`) inside the isolated container network.
- **Service Dependency & Healthchecks**: We configured a `healthcheck` on the database (`pg_isready`) and set `condition: service_healthy` on `depends_on`. The AI version had no healthchecks, causing a startup race condition where the Node API started querying the database before the database was ready.
- **Connection Resilience**: We added startup retry logic in our `database/database.js` to wait for PostgreSQL to boot. The AI version threw a fatal error and exited on the first database connection failure.
- **Volume Mount Correctness**: We mounted the volume at `/var/lib/postgresql` as recommended by newer Postgres images on Windows/Docker Desktop to avoid the `pg_ctl` subdirectory version mismatch error. The AI mounted to the legacy path `/var/lib/postgresql/data`, which caused immediate container exit.
- **Slim Multi-Stage Build**: We wrote a multi-stage Dockerfile that keeps build tools out of the final image and runs as a non-root `node` user for security. The AI wrote a heavy single-stage image running as root.

#### 2. What did the AI get wrong or quietly ignore?
- **Security Vulnerability (SQL Injection)**: The AI quietly wrote a direct string interpolation inside the DELETE query in `database.js` (`DELETE FROM tasks WHERE id = ${id}`) instead of using a parameterized placeholder (`$1`), introducing a critical SQL injection vulnerability.
- **Lack of Type Safety & Validation**: In the PUT endpoint, the AI failed to perform type validation on input variables, permitting empty string updates and non-boolean `done` attributes, which violates the schema constraints.

#### 3. What did the prompt forget to specify?
- We forgot to specify that the database might take several seconds to boot, requiring startup retry logic or docker-compose healthcheck coordination. The AI silently assumed the database would be instantly accessible.
- We forgot to specify the security standard for container execution (non-root). The AI defaulted to `root` permissions.
