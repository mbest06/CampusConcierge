# Hokie Concierge - backend kit (main agent + dining + transit)

This kit is the BACKEND ONLY. The Android app is built by a teammate in their own folder/stack and talks to
this backend through `API.md`. Nothing here touches their app.

It replaces the earlier starter / mobile-update / two-agent / full-kit zips. Don't also apply those.

## What's in it
| Path | What it is | Owner |
|---|---|---|
| `API.md` | The contract the Android app codes against (give this to your teammate) | all |
| `agents/main.py` | FastAPI template, one copy per agent (dining, transit); supports optional `location` | D |
| `agents/run_all.py` | starts dining (8001) + transit (8002) | D |
| `agents/load_gtfs.py` | builds `data/transit.json` from a transit GTFS zip | D |
| `agents/requirements.txt` | Python packages | D |
| `data/dining.json`, `data/transit.json` | PLACEHOLDER data (fake lat/lng) - replace with real | D |
| `web/lib/concierge.ts` | the MAIN agent: plan -> verify -> call -> answer | A |
| `web/lib/registry.ts` | agent list + mock `verifyAgent()` | C |
| `web/lib/gemini.ts` | Gemini helpers | A |
| `web/lib/summarize.ts` | folds events into the flat `/api/v1/ask` response | A |
| `web/lib/cors.ts` | CORS helpers used by every route | A |
| `web/app/api/v1/ask/route.ts` | **the endpoint the Android app calls** | A |
| `web/app/api/health/route.ts` | reachability check | A |
| `web/app/api/concierge*/route.ts` | older formats, kept for compatibility | A |
| `web/.env.example` | copy to `web/.env.local` and fill in | A |
| `examples/expo-reference/` | OPTIONAL working React Native reference client (not the team's app) | - |

## What this kit does NOT include
- The Next.js project files in `web/` (package.json etc.): create with `npx create-next-app@latest`
- The Android app (your teammate's)
