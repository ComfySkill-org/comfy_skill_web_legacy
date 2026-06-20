# Staging deploy (no custom domain yet)

## Frontend — Vercel

1. Import [comfy_skill_web](https://github.com/ComfySkill-org/comfy_skill_web) in Vercel
2. Environment variables (Preview + Development):

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://comfy-skill-api-staging.up.railway.app` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | from Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `comfy-skill-web.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `comfy-skill-web` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | … |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | … |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | … |

3. Firebase → Authorized domains → add `*.vercel.app`

## Backend — Railway / Render (private repo)

Deploy **two services** from `comfy_skill`:

| Service | Start command |
|---------|---------------|
| API | `alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Worker | `python -m worker.main` |

Secrets: see `.env.example` + `FIREBASE_SERVICE_ACCOUNT_JSON` (paste full JSON).

Set `CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000`

Set `COMFYUI_MOCK=true` until GPU Pod is ready.

## Stripe test webhook

```bash
stripe listen --forward-to https://<api-staging>/billing/webhooks/stripe
```

Copy `whsec_…` to `STRIPE_WEBHOOK_SECRET`.

## GitHub Actions secrets (optional CI E2E)

- `E2E_TEST_USER_PASSWORD`
- `STAGING_API_URL`
- `STAGING_WEB_URL`
