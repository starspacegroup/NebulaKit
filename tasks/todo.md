# NebulaKit completion ledger

This file is the acceptance ledger for the current independent-product quality pass. A task is
complete only when the implementation and its stated verification both pass. Local evidence,
GitHub merge state, and Cloudflare deployment evidence are tracked separately.

## P0 — release-blocking security

- [x] Replace client-authored profile cookies with opaque, revocable D1 sessions; reload identity
      and roles from D1 on every request; fail closed when session storage is unavailable.
- [x] Persist and consume one-time OAuth state for GitHub and Discord; bind account-link mode to an
      already authenticated server session.
- [x] Make authentication-key administration owner-only and reject unsupported provider writes.
- [x] Make destructive reset owner-only, revoke active sessions, and prevent setup from replacing an
      existing owner/configuration.
- [x] Sanitize CMS rich text before `{@html}` rendering and validate fields on both create and update.
- [x] Apply the existing owner-only PII reveal policy to the admin users API response.
- [x] Add focused regression tests for every P0 boundary above and include auth hooks in measured
      coverage rather than excluding the authorization boundary.

## P1 — product correctness and independence

- [x] Finish the independent-product conversion across code, Markdown, route copy, scripts, and
      comments; remove obsolete customization artifacts and broken links.
- [x] Install the NebulaKit social card, GitHub repository callout, Apple touch icon, manifest, and
      192/512 install icons; verify dimensions and metadata in tests.
- [x] Reconcile public-content, WebMCP, model-selection, voice, and Turnstile behavior with the
      discovery catalog and user documentation.
- [x] Align CI, package-manager commands, coverage floor, migration guidance, Cloudflare binding
      setup, and generated/ignored files with executable behavior.

## Verification and delivery

- [x] Run formatting and static checks.
- [x] Run focused unit/security tests and the full unit suite with the 95% coverage floor.
- [x] Apply D1 migrations to a local database and run migration-sensitive tests.
- [x] Run browser E2E and contrast validation.
- [x] Run binding validation and production build with real Cloudflare resource IDs, or record the
      exact external account/resource blocker without treating it as a passing gate.
- [x] Attempt the required HawkScan loop; if the runtime or API key remains unavailable, record that
      as missing DAST evidence rather than a security pass.

External evidence recorded on 2026-08-08:

- `bun run check:bindings` and `bun run build` fail closed because `wrangler.toml` intentionally
  contains placeholder D1/KV IDs. `bun run build:ci` passes, but no production-ready build or live
  Cloudflare binding verification is claimed until project-owned resources are provisioned.
- HawkScan could not run because neither the `hawk` runtime nor Docker is installed on this host.
  No HawkScan API key or hosted scan result was available, so DAST remains missing evidence rather
  than a security pass.

Stash-integration evidence recorded on 2026-08-08:

- All 34 stash-apply conflicts were resolved without remaining conflict markers. CMS-v2 editor,
  embed, proof, and route contracts were retained while the quality-pass auth and security
  boundaries were integrated.
- `bun run check` passed with zero errors and warnings. Focused auth/CMS verification passed, and
  `bun run test:coverage` passed with 2,149 tests passing and 22 skipped: 97.88% statements, 95.18%
  branches, 98.00% functions, and 98.44% lines.
- `bun run db:migrate:local` reported no pending local migrations. `bun run test:e2e` passed all 8
  Chromium tests, `bun run validate:contrast` passed both themes, and `bun run build:ci` completed
  with the expected placeholder-binding warning.
- Touched-file Prettier and `git diff --check HEAD` passed. During verification, another process
  advanced local `main` from `e24f2ce` through multiple unpushed commits; no push, stash drop, reset,
  or assistant-created commit was performed in this resolution session.

- [ ] Review the complete path-scoped diff, commit it on the feature branch, push, open a draft PR,
      resolve source-related hosted checks, squash-merge into `main`, and verify remote state.

## Explicitly outside this worktree

- [ ] After NebulaKit is merged, audit whether the same inherited fixes apply to Guides, nabu, and
      sortalizer in separate repository branches. Do not stage sibling-repository files here.
- [ ] Record any remaining design decision or external blocker without claiming completion.
