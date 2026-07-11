# Coding standards

## General

- Prefer small, cohesive modules and explicit interfaces. Avoid speculative abstractions.
- Validate at system boundaries; enforce invariants again in the database.
- Use UTC for persisted timestamps and expose timezone-aware values.
- Logs are structured and must exclude tokens, secrets, and personally identifiable information.

## Frontend

- Strict TypeScript; avoid `any`. Server Components are the default and Client Components require a reason.
- TanStack Query owns server state; React Hook Form plus Zod owns form state and validation.
- Centralize HTTP behavior in the Axios client. Components do not construct API URLs.
- Meet WCAG 2.2 AA and test behavior rather than implementation details.

## Backend

- Follow PEP 8, Black, isort, and Ruff. Add type hints to public service boundaries.
- Keep views thin; business rules belong in services/domain modules, not serializers or Celery tasks.
- Querysets must avoid N+1 access and migrations must be reversible and safe for rolling deploys.
- Tasks are idempotent and define retry, timeout, and failure-reporting behavior.
