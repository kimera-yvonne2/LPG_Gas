# LPG Guardian

Production-oriented monorepo foundation for a smart LPG cylinder monitoring platform connected to ESP32, load-cell, and HX711 hardware. This initialization deliberately contains no business features.

## Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui conventions, TanStack Query, React Hook Form, Zod, Recharts, Axios.
- Backend: Django, Django REST Framework, PostgreSQL, JWT, Celery, Redis, drf-spectacular, pytest.
- Delivery: Docker Compose, multi-stage Dockerfiles, GitHub Actions, Dependabot, pre-commit.

## Repository layout

```text
apps/frontend       Next.js web application
apps/backend        Django API and workers
packages/shared     Shared TypeScript contracts
docs                Architecture, API, security, and team practices
.github/workflows   Independent frontend and backend CI
```

## Quick start

The frontend and backend can be run independently as described below. To start the entire stack with Docker instead, use:

```bash
cp .env.example .env
docker compose up --build
```

Then visit `http://localhost:3000`, `http://localhost:8000/api/docs/`, or `http://localhost:8000/api/v1/health/`.

On Windows PowerShell, use `Copy-Item .env.example .env`. Development credentials in the example file are not suitable for shared or production environments.

## Run the backend

The backend loads configuration from `apps/backend/.env`. `DATABASE_URL` is parsed by Django and is used by all database and migration commands. Environment variables exported by your shell or hosting platform override values in the file.

From the repository root on Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r apps/backend/requirements-dev.txt
Copy-Item apps/backend/.env.example apps/backend/.env # skip if it already exists
Set-Location apps/backend
python manage.py migrate
python manage.py runserver
```

On macOS or Linux, activate the environment with `source .venv/bin/activate` and copy the example with `cp apps/backend/.env.example apps/backend/.env` before changing into `apps/backend`.

The API runs at `http://localhost:8000`; documentation is at `http://localhost:8000/api/docs/`. After changing Django models, create and apply migrations with:

```bash
cd apps/backend
python manage.py makemigrations
python manage.py migrate
```

## Run the frontend

Use a second terminal from the repository root:

```powershell
npm ci
Copy-Item apps/frontend/.env.example apps/frontend/.env.local # skip if it already exists
npm run dev
```

On macOS or Linux, use `cp apps/frontend/.env.example apps/frontend/.env.local`. The frontend runs at `http://localhost:3000` and uses `NEXT_PUBLIC_API_URL` to reach the backend.

For a production-style frontend build:

```bash
npm run build
npm --workspace @lpg-guardian/frontend run start
```

## Analytics dashboard

The responsive analytics dashboard is available at `/analytics` for authenticated users with access to telemetry. It reads the approved `GET /api/v1/readings/?ordering=timestamp&page_size=100` endpoint through TanStack Query and presents current gas, weight, safety, and historical trends.

Charts are lazy-loaded to keep the initial route bundle small. Each chart has an accessible text summary and a recent-telemetry table for nonvisual access. API failures expose a retry action; `401` and `403` responses use a permission-safe message without showing backend details.

No new backend endpoint, stored data, or migration is introduced. To roll back the UI, revert the frontend analytics page and telemetry chart component; existing telemetry APIs and authentication behavior remain unchanged.

## Quality commands

```bash
npm ci && npm run lint && npm run typecheck && npm test && npm run build
python -m pip install -r apps/backend/requirements-dev.txt
cd apps/backend
ruff check . && black --check . && isort --check-only . && pytest
python manage.py makemigrations --check --dry-run
python manage.py spectacular --api-version v1 --validate --file schema.yml
```

See [architecture](docs/architecture.md), [development guidelines](docs/development.md), [coding standards](docs/coding-standards.md), [API conventions](docs/api/README.md), [security](docs/security.md), and [Git workflow](docs/git-workflow.md).
## Depletion prediction

The backend asynchronously generates LPG depletion estimates from recent telemetry readings.

Each estimate includes:

- Estimated depletion date and time
- Estimated days remaining
- Confidence score
- Uncertainty window (lower and upper bounds)
- Model name and version
- Number of readings used

When there is insufficient or stale telemetry data, the system stores a safe fallback state instead of generating a potentially misleading prediction.

> **Warning**
>
> Depletion predictions are operational estimates only and must never be interpreted as safety guarantees. They are intended to assist refill planning and monitoring.