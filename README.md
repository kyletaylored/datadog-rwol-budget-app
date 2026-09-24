# RUM Without Limits Budget Copilot

A [Datadog App](https://docs.datadoghq.com/actions/datadog_apps/) that helps internal technical solutions team members support customers migrating from legacy RUM to [RUM Without Limits](https://www.datadoghq.com/blog/rum-without-limits/) (RWoL).

Legacy RUM bills ingestion and retention as a single SKU, so customers apply a flat client-side (head-based) sample rate to control cost — losing whichever sessions get sampled out, even the ones that mattered. RWoL splits this into two SKUs: **Measure** (ingest, cheap, covers 100% of sessions with performance metrics) and **Investigate** (index, priced per session actually retained). Retention is controlled server-side via **retention filters** that keep sessions based on their content — errors, funnel steps, user attributes — instead of an arbitrary sample rate (tail-based sampling).

Migrating customers hit two recurring problems:

1. They don't know which retention filters make sense for their app and business, or what sample rate to give each one.
2. They can't tell whether a candidate filter set will land under or over their existing budget until they've already turned it on.

This app gives a TSE a single guided flow, per RUM application, to work through both problems live with the customer.

## What it does

1. **Pick a RUM application** — pulled dynamically from the org via the Action Catalog, not hardcoded.
2. **See its current usage** — ingested sessions (Measure), indexed sessions (Investigate), and current retention rate for the last 30 days, plus any retention filters already configured on that application.
3. **Build a retention scenario** — pick an industry (e-commerce, fintech, media/streaming, SaaS, or generic) and toggle on contextual filter templates for that RUM application's type (browser, iOS, Android, React Native, Flutter). Each template ships a suggested query, sample rate, and the business rationale for why it's worth retaining — adjust both the sample rate and the estimated % of sessions matched to fit the real conversation.
4. **See the budget impact live** — as filters are toggled and tuned, the app recomputes projected Measure/Investigate/Replay cost against the customer's legacy spend, and reverse-solves the retention rate they can afford if the goal is to stay within their current budget while ingesting 100% of sessions into Measure.

This is a planning tool, not a source of truth: the retention-rate estimate assumes selected filters match independent, non-overlapping slices of sessions. Real filters can overlap (a session matching two filters is still billed once), so treat the numbers as directional and confirm actual retention in the RWoL usage dashboard once filters are live.

## Scope

Read-only in this version — it models retention filters and cost, but does not create or modify filters in the customer's org. It's built for an internal TSE to run against their own or a demo org, not for installing directly into a customer's org.

Not included yet (candidates for a follow-up pass):

- **Fleet Rollout Helper** — applying a scenario across many RUM applications at once, for orgs with a large number of apps.
- **Write-back** — actually creating the modeled retention filters via `createRetentionFilter` instead of just projecting their cost.

## Project structure

```
src/
  App.tsx                          Main UI: app picker, usage panel, scenario builder, budget model
  data/retentionScenarios.ts       Retention filter scenario templates (by app type + industry)
  lib/budgetModel.ts               Pure cost/retention calculation functions (no React/backend deps)
  getRumApplications.backend.ts    Lists RUM applications in the org
  getRumUsage.backend.ts           Ingested/indexed/replay session sums for one app, last N days
  getRetentionFilters.backend.ts   Existing retention filters for one app
_reference/
  rwol_dashboard.json              The out-of-the-box RWoL usage dashboard this app complements
  rum_retention_filters.md         Notes from the RUM retention filters learning course
```

Files matching `*.backend.ts` run as [Datadog-managed backend functions](https://docs.datadoghq.com/actions/datadog_apps/) — they're the only place allowed to call Datadog APIs, via [`@datadog/action-catalog`](https://docs.datadoghq.com/actions/action_interface/). Everything else is a normal Vite + React + TypeScript frontend styled with [DRUIDS](https://druids.datadoghq.com/).

## Getting started

Requires Node `^20.19.0` or `>=22.13.0`.

```bash
npm install
npx datadog-apps auth login --site datadoghq.com   # one-time; use your org's site if not datadoghq.com
npm run dev
```

`npm run dev` runs backend functions in-process against your logged-in org, so the app picker and usage numbers will reflect real RUM applications and usage data.

### Other scripts

| Command | Purpose |
| --- | --- |
| `npm run dev:verify` | Runs backend functions through the real cloud sandbox path, as a pre-publish parity check |
| `npm run build` | Production build |
| `npm run upload` | Upload the app to Datadog |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run lint:fix` | ESLint |

See `AGENTS.md` and `docs/agents/` for the fuller Datadog Apps development reference (backend functions, data access patterns, build/upload/auth, CI/CD).
