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

- [~] Review the complete path-scoped diff, commit it on the feature branch, push, open a draft PR,
  resolve source-related hosted checks, squash-merge into `main`, and verify remote state.

Delivery evidence recorded on 2026-08-08 (second session):

- Diff reviewed for publication safety across three independent audits: credential sweep, merge
  provenance, and hosted-check diagnosis. Doc corrections committed as `93a4624` and pushed to
  `fork/cursor/nebulakit-quality-pass-20260808`. Draft PR
  [#6](https://github.com/starspacegroup/NebulaKit/pull/6) already existed; its head now matches
  local `HEAD` (16 commits, 223 files). Remote state verified.
- Credential sweep: no live secret is introduced by `origin/main...HEAD`. The real D1/KV ids that
  appear in six intermediate `cms-v2-embeds` commits are the historically leaked ones already
  reachable from `origin/main` and already denylisted as `QUARANTINED` in `scripts/check-bindings.mjs`;
  publishing this branch changes their exposure by zero. They remain a pre-existing rotation item,
  not a branch fix. Branch tip `wrangler.toml` is placeholder-only.
- **Blocked, not passing — hosted checks.** Workflow run `31245359440` for PR #6 concluded
  `action_required` with zero jobs, so no check run was ever created; that is why the PR reads
  `UNSTABLE` while `gh pr checks` reports none. Cause is the fork-PR approval gate: the PR head is
  `donaldfilimon/NebulaKit` and `author_association` is `NONE`. Ruled out by direct query: workflow
  missing on base, trigger/branch filters, draft suppression, and Actions being disabled.
- **Blocked, not passing — squash-merge.** `gh api repos/starspacegroup/NebulaKit` returns
  `permissions: {admin: false, maintain: false, push: false, triage: false, pull: true}` for
  `donaldfilimon`. Approving the parked run, merging PR #6, and pushing local `main` (15 commits
  ahead of `origin/main`) all require write access this account does not hold. A maintainer of
  `starspacegroup/NebulaKit` must approve the run and perform the merge.
- Squash-merging collapses authorship: 6 of the 16 commits are authored by David Monaghan
  <monaghan.david@gmail.com> (the `cms-v2-embeds` lineage). The squash message needs a
  `Co-Authored-By:` trailer for them.
- Disclosure decision resolved and actioned in `620f6e2`. `ROADMAP.md` and
  `docs/PAYMENTS_AND_PPP.md` had published absolute local filesystem paths, the names of four
  private or third-party downstream projects, three downstream commit shas, and one third party's
  subscription pricing floor. Both `starspacegroup/NebulaKit` and `donaldfilimon/NebulaKit` report
  `private: false`, so that content was readable at the pushed fork branch. The owner chose to
  scrub paths and third-party names; downstream sources are now identified by what they are rather
  than who owns them. Nabu keeps its name as a first-party sibling already cross-linked from
  AGENTS.md. The PPP worked example keeps its placeholder figures, which carry the doc's
  PPP-is-not-FX point and disclose no real pricing.
- Residual disclosure closed in `8937376`, except where a rule forbids it. The attribution comments
  in `src/lib/server/pii-mask.ts` and `src/lib/utils/contact-validation.ts` now credit a downstream
  app without naming it, and the shared-database incident table in `docs/CLOUDFLARE_SETUP.md`
  identifies the six affected projects by role; the forensics are unchanged. First-party names
  (NebulaKit, Guides) stay, being already cross-linked from AGENTS.md.
- `.remember/` was untracked but not ignored, so `git add -A` could have committed session
  transcripts containing the identifiers being removed. Added to `.gitignore` in `8937376`.
- **Still open, needs an owner decision.** `migrations/0006_contact_form_submissions.sql` keeps its
  "Ported from AgapeVerse" comment. Migration files are immutable under the Release Rules, and that
  rule outranks a cosmetic scrub, so this needs a deliberate remedy rather than an edit.
- Correction to the P1 item "Finish the independent-product conversion across code, Markdown, route
  copy, scripts, and comments; remove obsolete customization artifacts and broken links." It was
  marked complete but was not: `README.md` still carried one starter-template line (fixed in
  `93a4624`), and `ROADMAP.md` called the product "the kit" 17 times and referenced
  `docs/ZERO_ENV_SETUP.md`, which `924a5ac` deleted when it retired the customization workflow. Both
  fixed in `7cd85e6`. The item is accurate as of that commit; it was not when first checked off.
- A review of this branch found seven guidance defects in the second-session doc commits, all
  verified against source and fixed in `8d14eeb`. The notable one: CLAUDE.md had documented the
  `0010_` collision as permanent, which is what surfaced that it is still fixable before merge.
- **Resolved.** The `0010_` collision is gone. A full review of PR #6 scored it the only finding
  above the reporting threshold, and it was fixed under `--fix`: `0010_oauth_transactions.sql` →
  `0011_oauth_transactions.sql` and `0011_minimize_oauth_tokens.sql` → `0012_minimize_oauth_tokens.sql`,
  via `git mv` so history follows. Both were branch-only and never applied to a remote D1, so §2
  immutability did not bind them, and both replay safely on a local D1 that had applied them under
  the old names. The sequence is now `0001_`–`0012_`, next is `0013_`. Doc references updated in
  `migrations/README.md`, `CLAUDE.md`, and here. Reported on the PR as
  [issuecomment-5225548231](https://github.com/starspacegroup/NebulaKit/pull/6#issuecomment-5225548231).
- **Resolved.** The Prettier drift is swept in `106c3ce`. 32 files carried it, including
  `.prettierrc` itself; `bunx prettier --check .` now passes across the whole repository for the
  first time. Formatting only, no hand edits. 12 `.svelte` files were included, so the sweep was
  verified past the formatter: `check` clean, coverage above floor, e2e 8/8, contrast both themes,
  `build:ci` compiled.
- **Resolved.** `isSuperAdmin` is honoured again by `requireAdmin` and `requireOwner` (`e0e509c`).
  `93bf6aa` had dropped the predicate when it consolidated `auth-guard.ts` into `auth-guards.ts`,
  deleting the covering test in the same commit without recording a reason, while `stats-guard.ts`
  kept honouring the flag — so a superadmin passed the stats guards and was refused by every admin
  API. The flag is now declared on `App.Locals` rather than only structurally in `stats-guard.ts`,
  and the restored test asserts the two files agree so they cannot silently diverge again. NebulaKit
  never sets the flag; the contract exists for downstream apps, which is what the deleted docstring
  said. Surfaced by the PR review at score 75 — below that workflow's reporting threshold, correctly,
  since in-repo impact is nil, but real and inherited by the siblings sharing this code.
- **Resolved without needing the ownership answer.** The `davis9001` handle and domain are gone from
  the four test files; fixtures now use `example-user` and `example.com`, and the URL-encoded form in
  `wayback.test.ts` was kept consistent. Nothing asserted the literal — all 56 tests in those files
  still pass. Waiting on whether the handle is the owner's or a third party's was the wrong gate:
  neutral fixtures are correct either way, costing nothing if it is the owner's and helping if it is
  not. The historical inconsistency is recorded below for the record.
- ~~**Still open, needs one owner decision.**~~ `davis9001` was classified inconsistently. `ROADMAP.md`
  anonymized it as a third-party downstream project, while an earlier entry here called it the
  owner's own handle and left it alone; those cannot both be right, and this ledger should not have
  asserted the ownership either way without evidence. The string remains in
  `tests/unit/wayback.test.ts`, `tests/unit/branch-coverage-boost.test.ts`,
  `tests/unit/branch-final-push.test.ts`, and `src/lib/components/ContentProof.test.ts`. If the
  ROADMAP classification is right the scrub is incomplete on a public repo; if the other is right the
  ROADMAP edit was unnecessary. Decide once and record it.

Full-gate evidence recorded on 2026-08-08 (second session), after the doc and scrub commits:

- `bun run test:coverage` passed: 97.86% statements, 95.13% branches, 97.96% functions, 98.42%
  lines — all above the 95 floor, with branches the narrowest margin at 0.13 points.
- `bun run check` reported 0 errors and 0 warnings across 1,634 files.
- `bun run validate:contrast` passed both themes against WCAG AA, and `bun run test:e2e` passed 8/8
  Chromium tests after `db:migrate:local`.
- `bun run build:ci` compiled with the expected placeholder-binding warning. Every local gate has now
  been run against the current tree; none rest on earlier entries.

Merge attempt recorded on 2026-08-08 (third session):

- The branch is merged into **local** `main` (fast-forward, now `106c3ce`) and pushed to
  `fork/cursor/nebulakit-quality-pass-20260808`, which is PR #6's head.
- Publishing to `origin/main` is **impossible from this account**, confirmed empirically rather than
  inferred: `git push --dry-run origin main` returns
  `remote: Permission to starspacegroup/NebulaKit.git denied to donaldfilimon` / HTTP 403. Local
  `main` is 29 commits ahead of `origin/main` and cannot be published. Squash-merging PR #6 needs the
  same write permission, so it is blocked on a maintainer of `starspacegroup/NebulaKit`, as is
  approving the parked workflow run that leaves the PR `unstable` with zero checks.
- No direct push to `origin/main` was attempted beyond the dry run. Even with permission it would
  bypass the PR the ledger specifies, and would publish 29 commits to a public default branch.

## Explicitly outside this worktree

- [ ] After NebulaKit is merged, audit whether the same inherited fixes apply to Guides, nabu, and
      sortalizer in separate repository branches. Do not stage sibling-repository files here.
- [ ] Record any remaining design decision or external blocker without claiming completion.
