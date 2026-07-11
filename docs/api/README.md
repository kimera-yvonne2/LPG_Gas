# API documentation

The API is versioned under `/api/v1/`. In development:

- OpenAPI schema: `GET /api/schema/`
- Swagger UI: `GET /api/docs/`
- ReDoc: `GET /api/redoc/`
- Health probe: `GET /api/v1/health/`

`drf-spectacular` is the source of generated API documentation. Endpoints must include schema annotations, request/response examples, permissions, errors, and idempotency behavior. Breaking changes require a new API version and migration plan.

The device-ingestion contract is deliberately not specified until sensor identity, calibration, replay protection, and transport are designed in Milestone 4.

## Authentication

Authentication endpoints are under `/api/v1/auth/`:

- `POST register/`: public household registration and verification email.
- `POST login/`: verified-user login; returns access, refresh, and user data.
- `POST token/refresh/`: rotates refresh tokens and blacklists replaced tokens.
- `POST logout/`: revokes the submitted refresh token.
- `POST password/reset/` and `POST password/reset/confirm/`: enumeration-safe reset flow.
- `GET email/verify/` and `POST email/resend/`: one-time verification and rate-limited resend.
- `GET /api/v1/users/me/`: current authenticated profile.
- `/api/v1/users/`: admin-role-only user and role management.

Access tokens contain `role` and `email_verified` claims. Server-side DRF permissions remain authoritative; clients must never treat token claims or hidden UI controls as authorization. Public registration always creates a `household`. Only an authenticated `admin` role may assign `admin`, `service_provider`, or `technician` roles.
