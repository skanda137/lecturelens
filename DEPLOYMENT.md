# Deploying LectureLens

The app is a single FastAPI service: it serves the built React frontend
(`frontend/dist`) as static files and exposes the API (`/process-audio`,
`/lectures`, `/stats`, `/bookmarks`, ...) from the same process on the same
port. There's nothing else to stand up — no separate frontend host, no
external database.

## Required environment variables

Set these on whatever host runs the container (see `.env.example` for the
same list with comments):

| Variable | Required | Notes |
|---|---|---|
| `GROQ_API_KEY` | yes | Used to structure transcripts into mind maps. |
| `DEEPGRAM_API_KEY` | yes | Used to transcribe uploaded/recorded audio. |
| `ALLOWED_ORIGINS` | yes in prod | Comma-separated list of origins allowed to call the API. Set this to your real public URL(s) — the default only allows localhost. |
| `DB_PATH` | recommended | Where the SQLite file lives. The Dockerfile sets this to `/data/lecturelens.db` on a volume; override if your platform mounts storage elsewhere. |
| `DEBUG` | no | Leave unset/`false` in production — `true` includes raw exception text in API error responses, which is a debugging convenience, not something to expose publicly. |

## Persistent storage

All lecture history, notes, and bookmarks live in one SQLite file at
`DB_PATH`. **Most PaaS free tiers wipe the container's filesystem on every
deploy/restart** — if you don't attach a persistent volume at `DB_PATH`'s
directory, every redeploy silently resets the app to empty. Any platform
that supports Docker volumes (Fly.io volumes, Railway volumes, a VPS bind
mount, etc.) works; just point `DB_PATH` at a path inside that volume.

## Build & run with Docker

```bash
docker build -t lecturelens .
docker run -d \
  --name lecturelens \
  -p 8000:8000 \
  -v lecturelens_data:/data \
  -e GROQ_API_KEY=... \
  -e DEEPGRAM_API_KEY=... \
  -e ALLOWED_ORIGINS=https://your-domain.example \
  lecturelens
```

The image is a multi-stage build: a Node stage runs `npm ci && npm run
build` for `frontend/`, and the final Python stage only contains the
backend plus the built static assets — no Node/npm in the runtime image.

## Build & run without Docker

```bash
# Backend
pip install -r requirements.txt
export GROQ_API_KEY=...
export DEEPGRAM_API_KEY=...
export ALLOWED_ORIGINS=https://your-domain.example

# Frontend (built once, served by the backend)
cd frontend && npm ci && npm run build && cd ..

python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

## HTTPS

The app itself doesn't terminate TLS — put it behind whatever your host
provides (most PaaS platforms terminate HTTPS automatically; on a bare VPS,
use a reverse proxy like Caddy or nginx with Let's Encrypt).

**This isn't optional for the Live Record feature**: browsers only grant
microphone access (`getUserMedia`) on secure contexts — `https://` or
`localhost`. Recording from a plain `http://` production URL will fail with
a permission error in every modern browser.

## Post-deploy checklist

- [ ] `ALLOWED_ORIGINS` set to your real domain (not the default localhost list, not `*`)
- [ ] `DEBUG` unset or `false`
- [ ] A persistent volume mounted at the `DB_PATH` directory
- [ ] Serving over HTTPS (required for microphone access)
- [ ] `GROQ_API_KEY` / `DEEPGRAM_API_KEY` set as secrets, not committed anywhere (the root `.gitignore` excludes `.env`, but double check your platform's secret manager is what's actually providing these, not a checked-in file)
