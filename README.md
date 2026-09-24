# UI Spec Studio

UI Spec Studio is an Agent-Native workspace for drafting structured UI specifications, previewing flows and wireframes, and reviewing proposed changes. The application UI is primarily in Japanese.

The public landing page is `/`. Sign in to create a project at `/projects`. A project conversation can draft a specification proposal; a person reviews and applies it at `/spec-proposals` before editing the saved specification at `/spec`. The format and review contract are in [docs/spec-format.md](docs/spec-format.md).

## Local development

Requirements: Node.js 22.22 or later, Corepack, and pnpm 12.6.0 (declared in `package.json`).

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
# For local development only, set AUTH_DISABLED=true in .env.
pnpm dev
```

Local development uses PGlite under `data/pglite` when `DATABASE_URL` is unset. The `data/` directory and `.env` are ignored. Never put real specifications, reference attachments, conversations, or credentials in the repository, including tests and screenshots.

Run the local checks with:

```sh
pnpm typecheck
pnpm exec vitest run --maxWorkers=1 --hookTimeout=30000
pnpm agent-native:doctor
```

The production build and production configuration checks are deferred until deployment settings are ready. This repository has no automatic deployment workflow. See [DEVELOPING.md](DEVELOPING.md) for the local verification policy.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before sending a change. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

There is currently no project-wide license grant in this repository. Public visibility does not imply permission to reuse its code or bundled assets. Existing upstream notices and attribution must be preserved; licensing will be clarified by the maintainer before broader reuse.
