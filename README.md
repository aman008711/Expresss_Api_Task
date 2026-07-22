# Secure Express API with Supabase Auth

This project is a learning-focused Node.js and Express API that uses Supabase Auth for identity management. It demonstrates a clean, commented server structure with public and protected routes, server-side validation, and interactive Swagger documentation.

## What it does
- Exposes public endpoints for anonymous access
- Protects selected routes with a reusable auth middleware
- Uses Supabase Auth for signup, login, logout, and token verification
- Keeps secrets in a git-ignored `.env` file
- Documents the API at `/docs` with Swagger UI

## Setup

### 1. Copy the example environment file
```bash
cp .env.example .env
```

### 2. Fill in your Supabase values
Edit `.env` and set:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
PORT=3000
```

> Do not use a service role key in this app. Only the anon key belongs in the client-side learning project configuration.

### 3. Install dependencies and run the server
```bash
npm install
npm start
```

The API will be available at `http://localhost:3000`.

## Endpoints

| Method | Endpoint | Auth required? |
|---|---|---|
| POST | `/auth/signup` | No |
| POST | `/auth/login` | No |
| POST | `/auth/logout` | Yes |
| GET | `/public/info` | No |
| GET | `/protected/profile` | Yes |

## Swagger UI
Open `http://localhost:3000/docs` to view the interactive API documentation.

### Swagger screenshot goes here

## Verification commands

### 1. Signup
```bash
curl -i -X POST http://localhost:3000/auth/signup -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"super-secret-password"}'
```

### 2. Login
```bash
curl -i -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"super-secret-password"}'
```

### 3. Public route
```bash
curl -i http://localhost:3000/public/info
```

### 4. Protected route without token
```bash
curl -i http://localhost:3000/protected/profile
```

### 5. Protected route with a token
```bash
curl -i http://localhost:3000/protected/profile -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Logout
```bash
curl -i -X POST http://localhost:3000/auth/logout -H "Authorization: Bearer YOUR_TOKEN"
```
