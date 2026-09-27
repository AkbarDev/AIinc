# TrendGrid (AIinc)

_Last updated: 2026-09-25T19:49:01+05:30_

![Refresh Trend Data](https://github.com/AkbarDev/AIinc/actions/workflows/refresh-trends.yml/badge.svg)
![Last Refresh](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/AkbarDev/AIinc/main/data/badges/last-refresh.json)
![Feeds Polled](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/AkbarDev/AIinc/main/data/badges/feeds-polled.json)

TrendGrid is an open-source, static-first platform that monitors global RSS feeds, clusters duplicate headlines, and publishes a ranked list of trending stories focused on technology, media, culture, and gaming. It is optimized for GitHub Pages + Cloudflare and relies entirely on open tooling.

## Architecture Overview

| Layer | Tooling | Notes |
| --- | --- | --- |
| Feed configuration | `config/sources.json` | List of high-authority RSS endpoints plus category, geo, and authority weights. |
| Ingestion + scoring | `scripts/fetch_feeds.py` (Python 3 stdlib) | Fetches feeds, normalizes items, computes trend scores, and writes `data/trends.json`. Supports `--sample` for offline development. |
| Data store | `data/trends.json` | Generated JSON consumed by the UI. Includes metadata (`generated_at`, `sources_scanned`, `clusters`). |
| Front-end | `index.html`, `css/style.css`, `js/app.js` | Static UI using vanilla JS and CSS. Fetches JSON, renders filters, hero card, timeline, and methodology. |
| Hosting | GitHub Pages + Cloudflare | Static deploy with custom domain (`snapfacts.in`). |

## Trend Score Formula

```
score = (source_signal × 0.30)
      + (recency × 0.25)
      + (keyword_volume × 0.20)
      + (authority × 0.15)
      + (engagement × 0.10)
```

- **source_signal** – unique publishers in the cluster (capped at 5)
- **recency** – exponential decay based on publication timestamp
- **keyword_volume** – matches against open-keyword inventory (AI, chip, festival, etc.)
- **authority** – average of source authority weights
- **engagement** – small heuristic boost for AI, blockbuster IP, esports finals

## Local Development

```bash
# Generate sample data without hitting RSS endpoints
scripts/fetch_feeds.py --sample

# Or fetch live feeds (requires outbound network + RSS availability)
scripts/fetch_feeds.py

# Preview the static site
python3 -m http.server 8000
```

`data/trends.json` is tracked in git so that GitHub Pages can serve the latest snapshot even if the ingestion Action is offline.

## Automating Updates

We ship a ready-to-run workflow: `.github/workflows/refresh-trends.yml`.

1. It runs every 5 minutes (and on manual dispatch) and first validates `robots.txt` + `sitemap.xml`, then executes `scripts/fetch_feeds.py`.
2. The workflow commits the refreshed `data/trends.json` back to `main` using `GITHUB_TOKEN` with `contents: write` permissions.
3. Extend the workflow with additional notifications or alternate schedules if needed.
4. Optional alerts: add a `SLACK_WEBHOOK_URL` repository secret (Slack incoming webhook or any compatible endpoint) to receive failure pings at no additional cost.
5. Shields badges read from `data/badges/*.json` via the Shields endpoint URLs shown above, so the homepage always advertises the last refresh time and feed coverage.

## Roadmap

### Phase 1 — SEO & measurement
- [x] 1. Google Search Console (Already Verified)
- [x] 2. GA4 (Tracking ID: G-K14N70DFTW)
- [x] 3. XML sitemap (Already implemented: `sitemap.xml`)
- [x] 4. News sitemap (`news-sitemap.xml` generated automatically via ingestion script)
- [x] 5. NewsArticle structured data (Already in `index.html` & dynamically generated)
- [ ] 6. Rich Results testing
- [x] 7. PageSpeed/Core Web Vitals (Lazy loading optimized in `app.js`)

### Phase 2 — User experience
- [ ] 8. Related articles
- [ ] 9. Search
- [ ] 10. Newsletter
- [ ] 11. Trending-news section
- [ ] 12. Social sharing
- [ ] 13. Web push notifications

### Phase 3 — AI
- [ ] 14. Gemini-powered article summarization
- [ ] 15. Automatic headline generation
- [ ] 16. Topic/category classification
- [ ] 17. Duplicate-news detection
- [ ] 18. Entity extraction
- [ ] 19. AI-generated "What happened?" summaries

### Phase 4 — Data/automation
- [ ] 20. Search Console API → your data pipeline
- [ ] 21. GA4 → analytics warehouse
- [ ] 22. Scheduled news collection
- [ ] 23. AI processing
- [ ] 24. Automated publishing

- NLP-powered clustering (e.g., cosine similarity on embeddings)
- Historical archives for week-over-week comparisons
- Geo heatmap + interactive timeline
- Integration with Decap CMS for editorial notes

---
Maintained by AIinc · Contributions welcome via pull requests.


## vNext Open-Source Tracks

### 1) API + Postgres backend (`/backend`)

- FastAPI service with PostgreSQL storage for saved articles.
- Core endpoints: `GET /health`, `GET/POST/DELETE /v1/saved`.
- Open-source packages only (`fastapi`, `sqlalchemy`, `psycopg`).

### 2) SEO hardening on current stack

- Added `WebSite` + `Organization` JSON-LD in `index.html`.
- Added dynamic `NewsArticle` JSON-LD graph for visible cards.
- Added `sitemap.xml`, `robots.txt`, and CI validation script `scripts/validate_seo.py`.
