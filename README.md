# ComfySkill Web (Public)

Skill-driven frontend for ComfyUI — simple UX, powerful workflows behind the scenes.

**Author:** Kelly Yang · [124ykl@gmail.com](mailto:124ykl@gmail.com)  
**Organization:** [ComfySkill-org](https://github.com/ComfySkill-org)

## Milestone 0

- Login with seeded accounts (staging)
- **Text → Image** with quality tiers: Good / Medium / Budget
- Admin dashboard (admin role only): jobs, users, metrics
- Light blue + light yellow design system

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 — API default: http://localhost:8000 (private backend repo).

## API contract

See [`openapi.yaml`](./openapi.yaml). Backend implementation lives in the private `comfy_skill` repository.

## Testing

See [docs/TESTING.md](./docs/TESTING.md).

## License

MIT — see [LICENSE](./LICENSE).

## Related

- Private platform API: `comfy_skill` (ComfySkill-org, private)
- ComfyUI execution engine: [comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI)
