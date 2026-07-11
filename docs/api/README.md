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

## LPG asset management

Authenticated, paginated resources are exposed under `/api/v1/`:

- `/households/`: household profiles linked one-to-one with household users.
- `/cylinders/`: household cylinders with kilogram-based capacity/tare/current weight and server-computed gas percentage.
- `/sensors/`: one ESP32/HX711 sensor identity per cylinder.
- `/readings/`: append-only sensor measurements; accepted readings update the cylinder's current weight and gas percentage atomically.

All collection endpoints support page-number pagination (`page`, `page_size`, maximum 100), documented filters, `search`, and `ordering`. Weight values use decimal kilograms, temperature uses Celsius, battery/gas values are percentages, and signal strength uses dBm.

Authorization rules:

- `admin`: full asset and reading access.
- `household`: manages its own household/cylinders and reads its own sensors/readings.
- `service_provider`: manages assets and submits readings across assigned platform inventory pending the tenancy milestone.
- `technician`: reads households/cylinders, manages sensors, and submits readings.

Querysets enforce household ownership before object lookup, so another household's asset returns `404` rather than disclosing its existence. Protected relationships prevent deletion of assets with dependent records.
