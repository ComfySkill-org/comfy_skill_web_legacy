# Testing ComfySkill

## Milestone 0 — E2E-001

**Goal:** `tester@comfyskill.local` logs in → text → image → sees output.

### Prerequisites

1. Private backend running (see [comfy_skill](https://github.com/ComfySkill-org/comfy_skill) — private)
2. `COMFYUI_MOCK=true` in backend `.env` **or** real ComfyUI with SD1.5 checkpoint
3. Frontend `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. Seed accounts created: `python -m app.seed`

### Run E2E locally

```bash
# Terminal 1 — backend API + worker (see private repo)
# Terminal 2 — frontend
npm install
npm run dev

# Terminal 3
E2E_TEST_USER_PASSWORD=TesterChangeMe123! npm run test:e2e
```

### Test accounts (staging)

| Email | Role | Env password |
|-------|------|--------------|
| admin@comfyskill.local | admin | ADMIN_SEED_PASSWORD |
| tester@comfyskill.local | tester | TEST_USER_PASSWORD |
| user@comfyskill.local | user | USER_SEED_PASSWORD |

### Unit tests (backend)

```bash
pytest tests/test_api.py
RUN_INTEGRATION_TESTS=1 pytest tests/test_integration.py
```
