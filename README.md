# TrendGrid (AIinc)

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

1. It runs every 15 minutes (and on manual dispatch) to execute `scripts/fetch_feeds.py`.
2. The workflow commits the refreshed `data/trends.json` back to `main` using `GITHUB_TOKEN` with `contents: write` permissions.
3. Extend the workflow with additional notifications or alternate schedules if needed.
4. Optional alerts: add a `SLACK_WEBHOOK_URL` repository secret (Slack incoming webhook or any compatible endpoint) to receive failure pings at no additional cost.
5. Shields badges read from `data/badges/*.json` via the Shields endpoint URLs shown above, so the homepage always advertises the last refresh time and feed coverage.

## Roadmap

- NLP-powered clustering (e.g., cosine similarity on embeddings)
- Historical archives for week-over-week comparisons
- Geo heatmap + interactive timeline
- Integration with Decap CMS for editorial notes

---
Maintained by AIinc · Contributions welcome via pull requests.
