# API documentation

The API is versioned under `/api/v1/`. In development:

- OpenAPI schema: `GET /api/schema/`
- Swagger UI: `GET /api/docs/`
- ReDoc: `GET /api/redoc/`
- Health probe: `GET /api/v1/health/`

`drf-spectacular` is the source of generated API documentation. Endpoints must include schema annotations, request/response examples, permissions, errors, and idempotency behavior. Breaking changes require a new API version and migration plan.

The device-ingestion contract is deliberately not specified until sensor identity, calibration, replay protection, and transport are designed in Milestone 4.
