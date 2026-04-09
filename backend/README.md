# Snapfacts FastAPI + PostgreSQL backend

Open-source backend for saved articles and future authenticated features.

## 1) Configure environment

```bash
cd backend
cp .env.example .env
```

Set `DATABASE_URL` to your Postgres instance.

Set `CORS_ORIGINS` as a comma-separated list of allowed frontend origins.

Recommended production target:

```text
https://api.snapfacts.in
```

## 2) Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3) Run migrations

```bash
alembic upgrade head
```

## 4) Run API locally

```bash
uvicorn app.main:app --reload --port 8834
```

## 5) Run with Docker Compose

```bash
docker compose up --build
```

This starts:
- PostgreSQL on `localhost:5432`
- FastAPI on `http://localhost:8834`

## 6) Endpoints

- `GET /health`
- `GET /v1/saved?user_key=<key>`
- `POST /v1/saved`
- `DELETE /v1/saved?user_key=<key>&article_id=<id>`

## Frontend API base

The current production frontend reads:

```js
window.SNAPFACTS_API_BASE
```

If not overridden, local builds use `http://localhost:8834` and production expects `https://api.snapfacts.in`.

## Migration discipline

Do not rely on implicit table creation in app startup.

Use Alembic for every schema change:

```bash
alembic revision -m "describe change"
alembic upgrade head
```

## Non-Docker VPS deployment

A native VPS deployment path using `systemd`, `nginx`, Python virtualenv, and PostgreSQL is documented in `deploy/VPS_DEPLOYMENT.md`.
