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

```bash
cp .env.example .env
docker compose up --build
```

Then visit `http://localhost:3000`, `http://localhost:8000/api/docs/`, or `http://localhost:8000/api/v1/health/`.

On Windows PowerShell, use `Copy-Item .env.example .env`. Development credentials in the example file are not suitable for shared or production environments.

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
