# Snapfacts Cleanup Plan

Last reviewed: 2026-04-09

## Goal

Clean up the Snapfacts codebase so it is easier to extend, while preserving:

- the GitHub Pages deployment path
- the RSS refresh pipeline
- the generated data contract
- the saved-articles API path

## Cleanup Principles

1. Remove confusion before removing functionality.
2. Preserve current URLs, JSON shapes, and deploy triggers unless intentionally changed.
3. Prefer small, testable cleanup steps.
4. Validate both static-site behavior and backend behavior after each stage.

## Stage 1: Safe Repository Hygiene

Scope:

- move or remove non-runtime planning artifacts
- consolidate project documentation
- clarify source-of-truth docs

Candidates:

- `Project design prompt file`
- `css/Project design phase 1_Tweaks`
- outdated or overlapping notes in:
  - `docs/knowledge-base.md`
  - `docs/site-enrichment.md`
  - `README.md`

Expected outcome:

- cleaner top-level structure
- less ambiguity for future contributors
- easier enhancement planning

Risk:

- very low if files are archived into `docs/` instead of deleted immediately

## Stage 2: Frontend Dead-Code Cleanup

Scope:

- remove render paths for DOM blocks that no longer exist
- remove unreachable skeleton logic tied to removed layout sections
- trim unused helper paths if no longer referenced

Known targets:

- `renderFeatureGrid()`
- `renderSidebar()`
- references to `#feature-grid`
- references to `#sidebar-list`
- associated stale CSS selectors if truly unused

Expected outcome:

- smaller client code
- clearer rendering model
- lower chance of regressions during future UI work

Risk:

- low, but should be validated in a browser after cleanup

## Stage 3: Data/UI Consistency Cleanup

Scope:

- make UI labels match actual runtime data
- align taxonomy and category behavior
- document intentional product decisions

Known targets:

- footer feed count should likely use `feeds_polled` and/or `feed_pool`
- decide whether `events` is:
  - a real roadmap tab hidden for now
  - a coming-soon placeholder kept intentionally
  - a category to remove until feed support exists

Expected outcome:

- UI says what the system actually does
- clearer user expectations

Risk:

- low if changes are small and localized

## Stage 4: Backend Scope Cleanup

Scope:

- verify which backend deployment path is canonical
- keep the used path, document the optional path clearly
- remove only genuinely unused backend artifacts after confirmation

Review questions:

1. Is Docker Compose actively used for local development?
2. Is the VPS `systemd` + `nginx` path the real production path for `api.snapfacts.in`?
3. Do we want both paths maintained, or one primary path and one archived path?

Current recommendation:

- keep both for now
- mark one as primary
- avoid deleting backend deploy files until that decision is made

Reason:

- these files are not obviously unnecessary; they represent alternative deployment modes

## Stage 5: Documentation Normalization

Scope:

- make `README.md` match the current product and repo layout
- reduce duplicated architecture explanations across docs
- keep one canonical architecture document and one operational cleanup/tracking document

Suggested source-of-truth split:

- `README.md`: concise project overview + local run + deploy summary
- `docs/architecture-review.md`: architecture and workflow explanation
- `docs/cleanup-plan.md`: cleanup roadmap
- `docs/site-enrichment.md`: enhancement log only

## Stage 6: Validation Checklist After Cleanup

Static site checks:

- `python3 -m http.server 8000`
- homepage loads
- category switching works
- lead card renders
- board cards render
- source section renders
- saved/preview interactions still work

Pipeline checks:

- `python3 scripts/validate_seo.py`
- `python3 scripts/fetch_feeds.py --sample`
- verify `data/trends.json` structure remains unchanged

Backend checks:

- API boots locally
- `GET /health` works
- `GET /v1/saved`
- `POST /v1/saved`
- `DELETE /v1/saved`

## Proposed Execution Strategy

Recommended implementation order:

1. Stage 1
2. Stage 2
3. Stage 3
4. validation pass
5. Stage 5
6. backend scope decision
7. Stage 4 only after confirmation

## Suggested Definition of Done

Cleanup is complete when:

- no obvious dead UI code remains
- top-level repo structure is intentional
- docs match the current architecture
- Pages workflow still deploys unchanged
- data refresh script still produces the same JSON contract
- backend saved-article flow still works
- the codebase is ready for the next enhancement stream
