# Environments & secrets (frontend)

## Rule: no secret keys in this repo

The frontend only uses **`NEXT_PUBLIC_*`** variables. These are bundled into the browser.

| Safe in frontend | Never in frontend |
|------------------|-------------------|
| Firebase Web API key (client) | Stripe `sk_*` / `whsec_*` |
| Public API URL | Firebase Admin JSON |
| App environment label | Database URLs, JWT secrets |

Stripe and Firebase Admin live in the **private** `comfy_skill` backend only.

## Three environments

| | Development | Staging (Preview) | Production |
|---|-------------|-------------------|------------|
| **File** | `.env.local` | Vercel Preview vars | Vercel Production vars |
| **Label** | `NEXT_PUBLIC_COMFYSKILL_ENV=development` | `staging` | `production` |
| **API** | `http://localhost:8000` | Railway staging URL | Production API URL |

## Setup

```bash
cp .env.development.example .env.local
# Edit .env.local locally — never commit
```

## Vercel

- **Development**: local `.env.local`
- **Preview**: `.env.staging.example` as checklist → Vercel Preview env
- **Production**: `.env.production.example` → Vercel Production env

Use separate Firebase projects for prod when you launch.

## Before push

```bash
./scripts/check-no-secrets.sh
```
