# Development guidelines

## Local setup

1. Copy `.env.example` to `.env` and replace development-only values.
2. Run `docker compose up --build`.
3. Open the UI at `http://localhost:3000` and API docs at `http://localhost:8000/api/docs/`.

For host-native development use Node 22+, npm 11+, Python 3.12+, PostgreSQL 17, and Redis 7.4. Install JavaScript packages with `npm ci` and Python packages from `apps/backend/requirements-dev.txt` in a virtual environment.

## Definition of done

- Acceptance criteria are covered by automated tests.
- Lint, formatting, type checks, tests, build, and migration checks pass.
- Security, privacy, observability, migration, and rollback impacts are addressed.
- API changes update OpenAPI annotations and examples.
- User-visible changes include accessible loading, empty, error, and success states.

Never commit secrets, production data, device credentials, or customer telemetry. Use anonymized fixtures.
