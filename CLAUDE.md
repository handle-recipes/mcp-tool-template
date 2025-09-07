# Project Goal
Headless Node.js TypeScript service that runs on Koyeb and calls `recipes-functions` endpoints using **Google-signed ID tokens** minted from a **service account JSON** secret.  
- GROUP_ID is set **per service via env** (not from branch).  
- No secrets in repo. Deploy with `npm run deploy` via Koyeb CLI.

# Env & Secrets
- `FUNCTION_BASE_URL` → base HTTPS URL for Functions v2.
- `GCP_SA_JSON` → full JSON key (injected via Koyeb secret).
- `GROUP_ID` → short string identifying the group (e.g., `group-01`).

# Behavior
- A simple loop (e.g., every 30–60s) demonstrating read+write calls:
  - list recipes
  - maybe create/update a test recipe (benign edits)
- All calls send header `x-group-id: GROUP_ID`.

# Auth
- Use `google-auth-library` to obtain an **ID token** for each function URL (audience = exact endpoint URL).
- Attach `Authorization: Bearer <token>` to requests.

# File Layout
- `src/types.ts` (shared models)
- `src/lib/auth.ts` (ID token client → axios instance)
- `src/api.ts` (thin wrapper over endpoints)
- `src/agents/examples.ts` (optional sample behaviors)
- `src/index.ts` (loads env, runs loop)
- `Dockerfile`

# Scripts
- `dev` (ts-node)
- `build` (tsc)
- `start` (node dist)
- `deploy` (Koyeb CLI: deploy service; attach env; secrets stored on Koyeb)

# Acceptance
- With env set locally, `npm run dev` calls Functions successfully.
- Header `x-group-id` is always present.
- `npm run deploy` works with Koyeb CLI; no creds stored in repo.
