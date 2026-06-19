# Contributing to ComfySkill

Thank you for helping build a simpler ComfyUI experience.

**Author / maintainer:** Kelly Yang · 124ykl@gmail.com  
**Org:** [ComfySkill-org](https://github.com/ComfySkill-org)

## Scope of this repo (public)

- Frontend UI/UX (Next.js)
- Marketing pages, i18n, accessibility
- E2E tests against **staging API**
- `openapi.yaml` — API contract (implementation is private)

## Out of scope (private platform repo)

- Database schema, migrations, secrets
- ComfyUI workflow templates (may move to private later)
- Stripe webhooks, admin billing internals

## Getting started

```bash
git clone git@github.com:ComfySkill-org/comfy_skill_web.git
cd comfy_skill_web
cp .env.example .env.local
npm install
npm run dev
```

Point `NEXT_PUBLIC_API_URL` at staging when available, or mock locally.

## Pull requests

1. Fork → branch from `main`
2. Keep PRs focused; link an issue if possible
3. Run `npm run lint` and `npm run build`
4. UI changes: include screenshot in PR
5. Do not commit secrets or `.env` files

## Good first issues

Look for labels: `good first issue`, `help wanted`, `Contributor-safe`.

## Code of conduct

Be respectful. Report issues to 124ykl@gmail.com.
