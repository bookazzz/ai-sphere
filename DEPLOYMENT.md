# AI-Sphere deployment

1. Back up the SQLite database and production environment file.
2. Generate a new `AISPHERE_JWT_SECRET`; deploying it intentionally signs every user out.
3. Install `backend/requirements.txt` and run `cd backend && alembic upgrade head`.
4. Bootstrap or promote the first administrator with `python -m app.cli.bootstrap_admin admin@example.com`.
5. Build the frontend with `npm ci && npm run build` and publish `out/`.
6. Start FastAPI from `backend/` with `uvicorn app.main:app --host 127.0.0.1 --port 8000`.
7. Install the reverse-proxy configuration from `deploy/nginx/ai-sphere.conf` and configure TLS paths.

Production must set `AISPHERE_ENVIRONMENT=production`, `AISPHERE_COOKIE_SECURE=true`, a unique JWT secret, HTTPS frontend URL, CORS origins, OpenRouter credentials and—when billing is enabled—Platega credentials and return URLs.

Monitor HTTP 5xx responses, rejected or duplicate payment webhooks, authentication failures, OpenRouter errors, and any attempted negative credit balance.

Large CSV/XLSX files under `datasets/seo/` are offline SEO research inputs. They are not loaded by either runtime and must be excluded from deployment artifacts.
