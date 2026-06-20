# Staging deploy (no custom domain yet)

> **Secrets:** Never commit keys. Use Vercel/Railway environment UI. See [ENVIRONMENTS.md](./ENVIRONMENTS.md).

## Frontend — Vercel

1. Import [comfy_skill_web](https://github.com/ComfySkill-org/comfy_skill_web)
2. Use **separate env scopes** in Vercel:

| Scope | `NEXT_PUBLIC_COMFYSKILL_ENV` | Config template |
|-------|------------------------------|-----------------|
| Preview (staging) | `staging` | `.env.staging.example` |
| Production | `production` | `.env.production.example` |

3. Firebase → Authorized domains → add `*.vercel.app`

## Backend — Railway / Render (private repo)

Set `COMFYSKILL_ENV=staging` and inject secrets via platform UI (not git).

| Service | Start command |
|---------|---------------|
| API | `alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Worker | `python -m worker.main` |

Use GitHub Environment **staging** for CI secrets if needed.

## Stripe test webhook

```bash
stripe listen --forward-to https://<api-staging>/billing/webhooks/stripe
```

Copy `whsec_…` into Railway **staging** secret `STRIPE_WEBHOOK_SECRET` only — not the repo.

