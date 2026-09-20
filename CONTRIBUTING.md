# Contributing to FLITO

## Setup

See the [Quick start](README.md#quick-start-local). Run `npm install` at the repo root too, which installs the pre-commit hook.

## Workflow

1. Branch from `main` (`feature/...`, `fix/...`).
2. Make the change with a test. Backend tests use an in-memory MongoDB, so they need no setup.
3. Run, in each project you touched:
   ```bash
   npm run lint
   npm test
   ```
4. Open a pull request. CI must pass.

## Conventions

- **Commits:** short imperative subject, explain the *why* in the body.
- **Logging:** use `src/utils/logger` in the backend, never `console` (ESLint enforces this).
- **Errors:** respond with `fail(res, status, CODE, message)` so the app can translate the code.
- **Text:** every user-facing string goes in `frontend/src/i18n/locales/{en,ne}`, both languages.
- **Comments:** explain why, not what.
- **Secrets:** only `.env.example` is committed.

## Reporting security issues

Do not open a public issue. Contact the maintainer directly.
