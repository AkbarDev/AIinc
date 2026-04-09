# Snapfacts Architecture Review

Last reviewed: 2026-04-09

## 1. Current System Shape

Snapfacts is a static-first news aggregation site with one optional dynamic feature layer:

1. A static frontend hosted on GitHub Pages.
2. A scheduled ingestion pipeline that refreshes trend data from open RSS feeds.
3. A separate backend API for saved articles.

At a high level:

```text
Open RSS Feeds
  -> scripts/fetch_feeds.py
  -> data/trends.json + data/badges/*.json
  -> GitHub Pages artifact
  -> Browser (index.html + css/style.css + js/app.js)
  -> optional calls to api.snapfacts.in for saved articles
```

## 2. Frontend Runtime Flow

Primary files:

- `index.html`
- `css/style.css`
- `js/app.js`

Runtime flow:

1. `index.html` loads the static shell, metadata, JSON-LD, fonts, and CSS.
2. `js/app.js` runs on `DOMContentLoaded`.
3. The app fetches `data/trends.json` with a cache-busting timestamp.
4. The app fetches `config/sources.json` to render the source inventory.
5. The app attempts to load saved articles from `window.SNAPFACTS_API_BASE`.
6. If the API is unavailable, the app falls back to browser `localStorage`.
7. The app renders:
   - lead story
   - category tabs
   - news board
   - footer status
   - timeline
   - source cards
   - dynamic `NewsArticle` schema graph

Important behavior notes:

- The UI is driven entirely from generated JSON, not server-side templates.
- Category grouping is partly source-driven and partly keyword-driven.
- If an item has no feed image, the frontend generates an SVG-based fallback image in-browser.
- The `saved` view is special: it merges current feed items and persisted saved records.

## 3. Data Generation Flow

Primary files:

- `config/sources.json`
- `scripts/fetch_feeds.py`
- `data/trends.json`
- `data/badges/last-refresh.json`
- `data/badges/feeds-polled.json`

Generation flow:

1. Load feed definitions from `config/sources.json`.
2. Fetch RSS/Atom XML using Python stdlib HTTP utilities.
3. Parse items, normalize title/summary/link/date/image.
4. Cluster similar items by normalized headline.
5. Compute weighted trend scores.
6. Filter to the freshness window for production runs.
7. Write `data/trends.json`.
8. Write badge JSON payloads for README / telemetry use.

Scoring inputs currently used:

- source signal
- recency
- keyword volume
- authority
- engagement

## 4. GitHub Pages and Workflow Pipeline

Primary file:

- `.github/workflows/refresh-trends.yml`

Current workflow behavior:

1. Triggered on:
   - push to `main`
   - schedule every 5 minutes
   - manual dispatch
2. Validates `robots.txt` and `sitemap.xml`.
3. On scheduled or manual runs only:
   - runs `scripts/fetch_feeds.py`
   - commits updated JSON/badge artifacts back to `main`
4. Touches `.nojekyll`.
5. Uploads the repo as a GitHub Pages artifact.
6. Deploys that artifact with `actions/deploy-pages`.
7. Sends Slack alerts on failure if `SLACK_WEBHOOK_URL` is configured.

Important behavior note:

- A code push to `main` deploys the currently committed static assets, but does not fetch fresh feed data in that same run because the fetch/commit steps are guarded with `if: github.event_name != 'push'`.

## 5. Backend API Flow

Primary files:

- `backend/app/main.py`
- `backend/app/database.py`
- `backend/app/models.py`
- `backend/app/crud.py`
- `backend/app/schemas.py`
- `backend/alembic/versions/20260327_0001_create_saved_articles.py`

API responsibilities today:

- healthcheck endpoint
- list saved articles
- create saved article
- delete saved article

Persistence flow:

1. FastAPI receives save/list/delete requests.
2. SQLAlchemy uses `DATABASE_URL` to connect to PostgreSQL.
3. Alembic manages schema creation and upgrades.
4. Saved articles are uniquely constrained by `(user_key, article_id)`.

Deployment options documented in repo:

- Docker Compose for local or simple containerized deployment
- native VPS deployment with `systemd` + `nginx` + PostgreSQL

## 6. Current Gaps and Friction Points

### A. Frontend code drift

`js/app.js` still contains rendering logic for `feature-grid` and `sidebar-list`, but those DOM nodes are absent from the current `index.html`.

Impact:

- no runtime break because of guards
- extra maintenance burden
- misleading architecture for future work

### B. UI/data mismatch in status strip

The footer currently labels a value as "Feeds monitored" but renders `state.sources.length` from config rather than the runtime `feeds_polled` or `feed_pool` values in `data/trends.json`.

Impact:

- users may see a static configured count instead of actual latest polling coverage

### C. Taxonomy mismatch around Events

The UI exposes an `events` category, but the code intentionally returns an empty state for that tab while event-like content still appears under other categories.

Impact:

- confusing user experience
- unclear editorial taxonomy

### D. Repo noise

The root contains planning/reference text files that do not appear to be part of runtime, build, deploy, or docs structure:

- `Project design prompt file`
- `css/Project design phase 1_Tweaks`

Impact:

- clutter
- unclear source of truth for design decisions

### E. Documentation drift

Some docs still describe older branding, old source counts, or older architecture snapshots.

Impact:

- onboarding friction
- harder enhancement planning

## 7. Recommended Cleanup Order

Recommended order of operations:

1. Clean repo structure and docs first.
2. Remove dead frontend code and align UI labels with real data.
3. Resolve taxonomy inconsistencies such as `events`.
4. Re-validate local preview and scheduled workflow assumptions.
5. Start new enhancement work only after the above is stable.

## 8. What Should Be Preserved

These parts are already serving the site's core workflow well and should be preserved during cleanup:

- static-first architecture
- generated JSON contract in `data/trends.json`
- GitHub Pages deployment model
- scheduled refresh workflow
- localStorage fallback for saved articles
- FastAPI + Postgres saved article path
- Alembic migration discipline
