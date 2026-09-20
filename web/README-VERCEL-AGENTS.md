# Add-on: run the dining + transit agents INSIDE the Next.js app (needed for Vercel)

Why: Vercel only runs your Next.js app. It does NOT run `python run_all.py`, so the Python agents on ports
8001/8002 won't exist there, and every answer would say the agents have no data.

## Add these 3 files (paths are inside the `web/` folder)
- `lib/agentSearch.ts`
- `app/api/agents/dining/query/route.ts`   (reads `web/data/dining.json`)
- `app/api/agents/transit/query/route.ts`  (reads `web/data/transit.json`)
Your existing `lib/concierge.ts` and `lib/registry.ts` need NO changes: they already read agent addresses from
`AGENT_URL_DINING` / `AGENT_URL_TRANSIT` and call `<address>/query`.

## Point the main agent at them (environment variables)
Local, in `web/.env.local` (change 3000 if your dev server uses another port):
```
AGENT_URL_DINING=http://localhost:3000/api/agents/dining
AGENT_URL_TRANSIT=http://localhost:3000/api/agents/transit
```
Vercel (Project -> Settings -> Environment Variables), using your production address:
```
AGENT_URL_DINING=https://YOUR-PROJECT.vercel.app/api/agents/dining
AGENT_URL_TRANSIT=https://YOUR-PROJECT.vercel.app/api/agents/transit
```
(Once your custom domain works you can switch these to `https://yourdomain.com/api/agents/...`.)
Redeploy after changing environment variables.

## Test locally (stop the Python agents first!)
```
curl -X POST http://localhost:3000/api/v1/ask -H "Content-Type: application/json" \
  -d '{"question":"I have $10 and I am hungry. What can I eat and which bus helps?"}'
```
Success: `"answered": true` for BOTH agents and a non-empty `pins` list.

## Notes
- The data files must have `lat`/`lng`, `costUsd`, `tags` on each row (same as before).
- These agents are public URLs. That's fine for a demo. Don't put anything secret in the data files.
- Vercel PREVIEW deployments may be login-protected, so the agents' calls to themselves can fail there. Test on the
  production deployment.
