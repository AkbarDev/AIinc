# Snapfacts VPS Deployment (No Docker)

This deployment path uses only standard open-source server components:

- `systemd` for process supervision
- `nginx` as reverse proxy
- `python3` virtualenv for FastAPI
- `postgresql` for storage
- `alembic` for schema migrations

## Recommended VPS profile

Minimum practical starting point:

- 2 vCPU
- 2 GB RAM
- 40+ GB SSD
- Ubuntu 24.04 LTS or Debian 12

This is enough for the current Snapfacts API workload because the backend is small and write volume is low.

## 1) Install packages

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx postgresql postgresql-contrib git
```

## 2) Create system user and app directory

```bash
sudo useradd --system --create-home --shell /bin/bash snapfacts
sudo mkdir -p /srv/snapfacts
sudo chown -R snapfacts:www-data /srv/snapfacts
```

## 3) Clone repo and prepare backend

```bash
cd /srv/snapfacts
sudo -u snapfacts git clone https://github.com/AkbarDev/AIinc.git .
cd /srv/snapfacts/backend
sudo -u snapfacts python3 -m venv .venv
sudo -u snapfacts .venv/bin/pip install --upgrade pip
sudo -u snapfacts .venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:

```bash
DATABASE_URL=postgresql+psycopg://snapfacts:<strong-password>@localhost:5432/snapfacts
APP_ENV=production
CORS_ORIGINS=https://www.snapfacts.in,https://snapfacts.in
```

## 4) Create PostgreSQL database

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE USER snapfacts WITH PASSWORD '<strong-password>';
CREATE DATABASE snapfacts OWNER snapfacts;
\q
```

## 5) Run migrations

```bash
cd /srv/snapfacts/backend
sudo -u snapfacts .venv/bin/alembic upgrade head
```

## 6) Install systemd service

Copy `deploy/systemd/snapfacts-api.service` to:

```bash
/etc/systemd/system/snapfacts-api.service
```

Then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable snapfacts-api
sudo systemctl start snapfacts-api
sudo systemctl status snapfacts-api
```

Logs:

```bash
sudo journalctl -u snapfacts-api -f
```

## 7) Install nginx site

Copy `deploy/nginx/api.snapfacts.in.conf` to:

```bash
/etc/nginx/sites-available/api.snapfacts.in.conf
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/api.snapfacts.in.conf /etc/nginx/sites-enabled/api.snapfacts.in.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 8) DNS

Point:

- `api.snapfacts.in` -> VPS public IP

If Cloudflare is in front:

- keep proxied mode on
- SSL mode should be `Full` or `Full (strict)`

## 9) SSL

If Cloudflare terminates SSL and talks HTTP to origin, nginx config above is enough to start.

If you want origin TLS too, install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.snapfacts.in
```

## 10) Smoke test

```bash
curl http://127.0.0.1:8834/health
curl https://api.snapfacts.in/health
```

Expected:

```json
{"status":"ok"}
```

## Scalability and fault tolerance

What this stack handles well:

- low to moderate API traffic
- frequent reads and light writes
- one-node operation with simple recovery
- process restarts via `systemd`
- reverse proxy buffering and connection handling via `nginx`

What makes it fault tolerant enough for current Snapfacts:

- `systemd` restarts the API if it crashes
- `postgresql` is isolated from app restarts
- `nginx` shields the app from direct internet exposure
- Cloudflare can absorb traffic spikes and basic network abuse

What it does not provide yet:

- multi-node failover
- database replication
- zero-downtime rolling deploys
- cross-region redundancy

When to upgrade:

- If API CPU remains high under load, move to `gunicorn` with multiple `uvicorn` workers.
- If DB load grows, move Postgres to a managed or dedicated database host.
- If uptime becomes business-critical, add a second app node behind a load balancer.

## Recommended next command after deploy

After the API is live, test save/unsave from:

- `https://www.snapfacts.in`
