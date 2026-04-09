# Integration & Tooling Reference

_Last updated: 11 February 2026_

## 1. Scheduler & Automation
| Component | Status | Notes |
| --- | --- | --- |
| **GitHub Actions** (`.github/workflows/refresh-trends.yml`) | Active (runs every 5 minutes) | Pulls repo, runs `scripts/fetch_feeds.py`, writes `data/trends.json` + `data/badges/*.json`, commits/pushes. Uses only free GitHub Actions minutes (public repo). |
| **Skip-on-no-change guard** | Active | Script compares new output with current snapshot; exits early if no new feeds, preventing needless commits. |

## 2. Webhooks & Alerts
| Channel | Endpoint | Purpose | Setup |
| --- | --- | --- | --- |
| **Slack (optional)** | `SLACK_WEBHOOK_URL` secret | Receives failure alerts from the GitHub Action’s `notify-failure` job. | Create Slack Incoming Webhook (free), add secret under repo settings; no runtime cost. |
| (Future) Email / Teams | _TBD_ | Additional escalation if Slack unavailable. | Add step in workflow referencing new secret/webhook. |

## 3. Client-Side Tooling
| Tool | Role | Notes |
| --- | --- | --- |
| **Vanilla JS (`js/app.js`)** | Fetches data & renders UI. | Uses `fetch` API; no framework/bundler. Works offline via sample data. |
| **Shields.io endpoint badges** | Displays last refresh + feeds polled. | Reads the JSON emitted in `data/badges/`. Hosted as static files so GitHub Pages serves them directly. |
| **Google Fonts + Font Awesome** | Typography/icons. | Free CDN usage; asses if self-hosting needed later. |

## 4. Backend / Data Integrations
| Source | Type | Refresh cadence | Scale considerations |
| --- | --- | --- | --- |
| Google News (Top Stories + Entertainment) | RSS | Multiple updates per hour (minutes) | Already open; monitor rate limits if adding more queries. |
| Bing News (Tech + Media) | RSS | Minutes | Add query variations for region-specific feeds if needed. |
| Wired, Variety, TechCrunch, Rolling Stone, Ars Technica, IGN | RSS | Few to dozens of posts daily | Future: add health monitor to detect feed downtime. |

## 5. Deployment Stack
| Layer | Tool | Notes |
| --- | --- | --- |
| Hosting | GitHub Pages + Cloudflare DNS | Free, static. Cloudflare handles SSL + caching. |
| Preview | `python3 -m http.server` | Local manual testing. |
| Version control | Git + GitHub | All changes tracked; history doubles as data archive. |

## 6. Future Integrations Roadmap
1. **Decap CMS** for curated editorials layered on top of JSON output.
2. **OneSignal / Web Push** for subscriber notifications once personalization ships.
3. **Analytics** via Plausible/Umami (self-hosted) for privacy-first insights.
4. **Data warehouse** (DuckDB/SQLite) to keep historical trend snapshots if long-term analytics required.
5. **Monitoring hooks** (e.g., GitHub Action that pings Opsgenie/Teams on repeated failures).

Use this document to track new webhooks, external APIs, or tooling approvals as the MVP evolves into a full product.
