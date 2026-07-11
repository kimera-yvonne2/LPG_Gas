# Security baseline

- Store secrets in deployment secret managers and rotate them; `.env` is local-only.
- Authenticate people with rotating JWTs and devices with a separate, revocable identity mechanism.
- Apply object-level authorization and deny access by default.
- Rate-limit authentication and ingestion endpoints at the edge and application layers.
- Sign or otherwise authenticate telemetry and protect against replay before production ingestion.
- Pin dependencies, review automated updates, scan images, and generate an SBOM during deployment work.
- Report vulnerabilities through private GitHub security advisories.
