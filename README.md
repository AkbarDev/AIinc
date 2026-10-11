# TrendGrid (AIinc)

_Last updated: 2026-10-11T12:08:00+05:30_

> **Note:** Phase 1 (SEO & Measurement) is fully completed and pushed to GitHub. Going forward, all code changes will be automatically committed and pushed directly to the remote repository without manual intervention.

### Recent Enhancements (2026-10-11T12:08:00+05:30)
- **Upgraded AI Editorial Visual Generation to Gemini 1.5 Flash + Google Imagen 3**:
  - Replaced the low-quality Pollinations AI fallback pipeline in `scripts/fetch_feeds.py`.
  - Added `enhance_prompt_with_gemini_flash()` to construct structured, magazine-quality 16:9 editorial prompts analyzing headlines and summaries.
  - Prioritized **Google Imagen 3** (`imagen-3.0-generate-002`) via Gemini API for crisp, high-resolution visual storytelling with zero text overlays, logos, or template artifacts.
  - Set high-definition curated editorial photography as fallback in the event of upstream rate-limiting.

### Recent Enhancements (2026-10-11T12:00:00+05:30)
- **Removal of "Snapfacts Brief" / Shorts Section Across All Tabs**:
  - Removed `#quick-brief` section container and list markup from `index.html`.
  - Removed `#brief-toggle` ("Shorts") button from mobile reader tools.
  - Removed all corresponding CSS styling and dynamic DOM population logic in `js/app.js`.
- **Removal of Header "SYNC" and "SAVED" Navigation Tabs**:
  - Removed `{ key: 'saved', label: 'SAVED' }` and `{ key: 'sync', label: '⚙️ SYNC' }` from `HEADER_CATEGORIES`.
  - Removed `#sync-dialog` modal from `index.html` and cleared sync trigger logic from category navigation.
  - Streamlined primary navigation strictly to editorial intelligence categories (`AI`, `COMMERCE`, `TECH`, `ADS`, `STARTUP`, `MEDIA`, `BRANDS`) and the `🏆 LLM LEADERBOARD` home tab.
- **Service Worker Cache Upgrade**:
  - Incremented cache to `snapfacts-v3` to purge stale cached assets.

### Recent Enhancements (2026-10-11T11:45:00+05:30)
- **Removal of SnapFacts Brief Chat Window & Sidebar Form**:
  - Completely removed the floating `#ai-chat-widget` window and chat trigger button from the homepage.
  - Removed the sidebar newsletter/brief submission widget (`.newsletter-widget`), eliminating all residual chat/newsletter forms.
- **Full Display View Stretch for News Cards (Left-to-Right Edge Expansion)**:
  - Redesigned `.news-board-shell` to full 100% width with no restrictive sidebar constraints, expanding max viewport canvas to 1440px / 96vw.
  - Upgraded `.news-card-grid` to stretch edge-to-edge with responsive auto-fill (`minmax(360px, 1fr)`), allowing news cards to render in an unconstrained, widescreen editorial presentation.
- **Homepage Streamlining & 6-Column Ribbon Removal**:
  - Removed the 6 vertical column cards (`.arena-stats-ribbon`) from the homepage layout.
  - Kept a single unified Frontier LLM Leaderboard Standings Table & Model Matrix with benchmark ratings, direct links to Arena feeds, and category navigation.

### Recent Enhancements (2026-10-11T11:36:00+05:30)
- **Dedicated LLM Leaderboard Homepage (Zero News Cards on Home)**:
  - Transformed the home view (`all`) into the **LMSYS Chatbot Arena Leaderboard Homepage**:
  - Removed all news cards from the homepage to maintain clear architectural focus on LLM model benchmarks and evaluation parameters.
  - Implemented the interactive **Frontier LLM Leaderboard Table & Stats Matrix** on the home dashboard (tracking GPT-4o, Claude 3.5 Sonnet, o1, Gemini 1.5 Pro, Llama 3.1 405B, Qwen 2.5, DeepSeek-V2.5) with Elo ratings, coding scores, context sizes, and direct links to [arena.ai/leaderboard](https://arena.ai/leaderboard).
  - Added an interactive **Category News Exploration Rail** with verified article counts directing users directly to dedicated category feeds.
- **Relocated All News Cards to Dedicated Category Tabs**:
  - News cards strictly render when viewing their respective category tabs (`AI`, `COMMERCE`, `TECH`, `ADS`, `STARTUP`, `MEDIA`, `BRANDS`, `SAVED`).
  - Added automatic view-switching (`is-category-view`) that hides the hero front-section when browsing category feeds so news cards are immediately visible at the top of the viewport.
  - Sidebar dynamically adapts: shows LMSYS Arena fast-look stats on the homepage, and contextual trending stories when viewing category tabs.
- **Removal of Google Stack Tools from News Feed Grid**:
  - Cleaned the news grid of Google tools cards and removed the navigation pill (`⚡ FREE AI TOOLS`), ensuring the core news feed consists purely of authentic aggregated industry editorial stories.
- **Dynamic LLM Parameters & Benchmark Carousel**:
  - Replaced legacy news story and cockpit carousels with a dedicated **Frontier LLM Parameters & Leaderboard Carousel**.
  - **Direct Dynamic Linking to LLM Feeds & Benchmarks**: Each slide links out to live benchmark feeds including the **LMSYS Chatbot Arena Leaderboard** (`https://arena.ai/leaderboard`) and Hugging Face Open LLM Leaderboard.
  - **Parameter & Metric Matrices**: Every slide showcases key model parameters including Arena Elo ratings, 2,000,000 token context window capacity, HumanEval/SWE-Bench verified coding ratings, and open-weight parameter sizes (Llama 3.1 405B, DeepSeek-V2.5, Qwen 2.5).
  - **Editorial 16:9 Visual Framing**: Custom high-resolution editorial imagery with glassmorphic cards, live status pulse dots, parameter chips, and direct external action buttons.
  - **Optimized Mobile & Touch Carousel Navigation**: Full swipe gesture support, keyboard accessibility, and subtle auto-rotation.
- **Authentic Editorial News Card Redesign**:
  - **Contextual Media Frame (16:9)**: Cinematic image framing with smooth scale hover micro-interactions, soft gradient vignette, category jump pill, read time indicator, and distinct AI vs. Press badges.
  - **Publisher Credibility Bar**: Embedded source favicons, publication name, and real-time relative timestamps (`15m ago`, `2h ago`).
  - **"Signal Context" Key Takeaway Box**: Perplexity/Axios-style high-contrast bullet block summarizing the actionable market impact for readers.
  - **Unified Bottom Action Toolbar**: Clean circular icon cluster for instant bookmarking, text-to-speech audio listening, speed-reading, visual card generation, and native social sharing.

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
- [x] 8. Related articles
- [x] 9. Search
- [x] 10. Newsletter
- [x] 11. Trending-news section
- [x] 12. Social sharing
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
