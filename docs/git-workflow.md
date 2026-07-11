# Git and delivery workflow

## Branch strategy

Use short-lived branches from `main`: `feat/issue-short-name`, `fix/issue-short-name`, `docs/...`, or `chore/...`. Protect `main`; require pull requests, passing frontend/backend checks, current branches, and at least one approval. Prefer squash merges and delete merged branches.

## Conventional commits

Format: `<type>(optional-scope): imperative summary`. Supported types include `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, and `revert`.

Examples:

- `feat(devices): register an ESP32 identity`
- `fix(telemetry): reject duplicate sequence numbers`
- `ci: enforce migration checks`

Use `!` and a `BREAKING CHANGE:` footer for breaking changes. Reference issues in the footer, e.g. `Closes #42`.
