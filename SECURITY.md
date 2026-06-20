# Security

Report issues: 124ykl@gmail.com

- Never commit `.env.local` or files with Stripe/Firebase Admin secrets.
- Frontend: only `NEXT_PUBLIC_*`; see `docs/ENVIRONMENTS.md`.
- Backend secrets stay in the private `comfy_skill` repository / host env.
