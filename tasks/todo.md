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
  the old names. The sequence was `0001_`–`0012_` as of that fix, next `0013_`; `0013_session_payload.sql`
  has since landed with the opaque-sessions merge, so the current next number is `0014_`. Doc references updated in
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
  `main` was 29 commits ahead of `origin/main` at that time (35 as of 2026-08-09) and cannot be
  published. Squash-merging PR #6 needs the
  same write permission, so it is blocked on a maintainer of `starspacegroup/NebulaKit`, as is
  approving the parked workflow run that leaves the PR `unstable` with zero checks.
- No direct push to `origin/main` was attempted beyond the dry run. Even with permission it would
  bypass the PR the ledger specifies, and would publish 29 commits to a public default branch.

Agent-guidance drift corrected on 2026-08-09 (fourth session):

- `CLAUDE.md` was last written at `2f3a4b0`; `db30a29` and `c7040ab` (the opaque-sessions merge)
  landed after it and falsified four statements. All four are fixed. Everything else in the file was
  re-verified against source and still holds: the 95 thresholds in `vite.config.ts`, `devPort: 4277`,
  the 14-file `git grep -ln "AGENTS.md §"` count, the CI job topology and `BUN_VERSION` pin, the
  `docs/` table, and the absence of a `lint`/`format` script.
- The migration inventory said `0001_`–`0012_`, next `0013_`, in three places — `CLAUDE.md`, the
  `Current Migrations` table in `migrations/README.md` (which omitted the row entirely), and the
  `0010_`-collision entry above. `0013_session_payload.sql` has landed; next is `0014_`. The
  `CLAUDE.md` numbering paragraph now carries `0013_` as its second worked example: it was authored
  as `0011_` on the opaque-sessions branch, `main` had meanwhile shipped `0011_` and `0012_`, and it
  took the next free slot at merge rather than anything on `main` being renamed.
- The auth paragraph still described the retired cookie scheme — "a signed opaque session token …
  its digest and expiry live in D1". Nothing is signed. Rewritten to the actual scheme: an opaque
  random token, the row keyed by its SHA-256, expiry **and** the trusted payload in `sessions.data`,
  `getAuthSession` failing closed on both a forged cookie and a pre-`0013_` row with no payload, and
  an explicit instruction not to reintroduce a cookie the hooks trust without a server-side lookup.
  Two further invariants were undocumented and are now recorded: the `datetime(expires_at)`
  normalization (a raw string compare sorts `'T'` after `' '` and reads a same-day expiry as valid
  for up to a day), and the two coexisting session APIs in `db.ts`.
- **Checked and found still true, so not changed as a finding:** the per-request privilege refresh
  survived the merge. `authHandler` takes identity from the stored payload but re-reads `is_admin`,
  `can_view_stats`, and owner status from `users` on every request, so the AGENTS.md Security
  Boundaries rule holds and revocation still needs no re-login. The `isPretend` bypass, gated on
  `isDevAuthSimulationEnabled`, is now stated explicitly rather than left implicit.
- Docs only, no source touched. `bunx prettier --check` clean on all three files, `git diff --check`
  clean, and `product-identity` + `agent-readiness` pass 53/53 — those are the suites that read these
  files off disk. No coverage or e2e claim is made, because nothing under coverage changed.
- Delivered as `46a0247` on `docs/agent-guidance-drift-20260809`, pushed to
  `fork/cursor/nebulakit-quality-pass-20260808` as a fast-forward from `c7040ab` — so **PR #6 now
  carries it** and reports `MERGEABLE` / `mergeStateStatus: CLEAN` at head `46a0247`. A fresh PR was
  considered and rejected: the corrections only parse on top of the opaque-sessions work, which is
  not on `origin/main`, so a new PR would have shown 36 commits rather than four doc files. PR #6's
  head is now 36 commits ahead of `origin/main`; local `main` is untouched at `c7040ab` (35 ahead).
- Noted, not acted on: PR #7 (`security/opaque-sessions`, base `main`) is open on the org repo and
  overlaps PR #6, which already contains the merge of that branch at `c7040ab`. Whoever merges these
  needs to decide the order; both cannot land independently without a conflict or an empty diff.
- Both open PRs are consolidated on `fork/dev` as of 2026-08-09, which fast-forwarded `c7040ab` →
  `952438c`. "All PRs" is two, and PR #7 needed no separate merge: its head `db30a29` is already an
  ancestor of PR #6's head, verified with `git merge-base --is-ancestor`. `fork/dev` now contains
  both heads.
- **This closes nothing and is not the acceptance criterion.** Both PRs target `starspacegroup:main`,
  so merging into a fork branch leaves them `OPEN`. The org repo has **no `dev` branch at all** —
  only `main`, `cms-v2-embeds`, and `security/opaque-sessions` — and one cannot be created from this
  account under the same 403. Note also that `ci.yml` triggers on `main`/`develop`, so a branch named
  `dev` would not run CI even if it existed on the org repo.

Delivery evidence recorded on 2026-08-10 (sixth session):

- The consolidation moved to a dedicated branch and PR: `consolidate/local-main-20260810` is PR
  [#9](https://github.com/starspacegroup/NebulaKit/pull/9) (42 commits, head `8443b8b`, base
  `main`), and the heads of PR #6 (`46a0247`), PR #7 (`security/opaque-sessions`), and PR #8
  (`cms-v2-embeds`) are all ancestors of that head — verified with `git merge-base --is-ancestor`,
  so merging #9 strictly contains all three.
- **The hosted-checks blocker is resolved for PR #9.** A maintainer approved the fork-PR workflow
  runs, and CI has now executed on `starspacegroup/NebulaKit` for the first time. Both jobs are
  green at head `8443b8b`: Test & Coverage and E2E Tests, run `31439300377` (2026-08-10). PR #9
  reports `MERGEABLE` / `mergeStateStatus: CLEAN`. Getting there took two fixes this session:
  `e3b87b9` regenerated `bun.lock` with released Bun 1.3.14 (a canary had written
  `lockfileVersion: 2`, which the pinned CI Bun cannot parse, so `--frozen-lockfile` aborted at
  install), and `8443b8b` fixed an E2E command-palette hydration race. Nine Codex review findings
  on #9 were also addressed, replied to, and resolved (`b44470c` and follow-ups).
- **PR #6 now runs CI and fails both jobs** at `bun install --frozen-lockfile` (run `31434971833`):
  its head still carries the canary `bun.lock`. Not fixed there deliberately — its head is an
  ancestor of #9's, and pushing a lockfile commit to it would fork the lineage for a PR that #9
  supersedes. The failure is an argument for merging #9 and closing #6, not a regression to chase.
- **Still blocked, re-verified today — publication.** `git push --dry-run origin main` returns
  `Permission to starspacegroup/NebulaKit.git denied to donaldfilimon` (403), unchanged. The
  remaining acceptance step is a maintainer squash-merging PR #9 and closing the superseded PRs
  (#6, #7, and #8's content all land with it). The squash message still needs the
  `Co-Authored-By: David Monaghan <monaghan.david@gmail.com>` trailer for the `cms-v2-embeds`
  lineage commits.
- `CLAUDE.md`'s CI paragraph claimed the workflow had never executed; falsified by the runs above
  and rewritten this session with the run ids, including PR #6's live demonstration of the
  canary-lockfile trap the same file documents.

## Explicitly outside this worktree

- [~] After NebulaKit is merged, audit whether the same inherited fixes apply to Guides, nabu, and
  sortalizer in separate repository branches. Do not stage sibling-repository files here.
- [ ] Record any remaining design decision or external blocker without claiming completion.

Sibling audit, read-only pass recorded on 2026-08-08 (fourth session):

- The audit's read-only half does not depend on the merge gate, so it was run; propagation of any fix
  still waits on PR #6 landing. No sibling-repository file was staged, edited, or committed.
- **4 of the 7 P0 items were compared** across Guides, nabu, and sortalizer. Not yet audited:
  sanitize-before-`{@html}`, one-time OAuth state consumption, and the coverage-inclusion item.
  ~~Not yet audited~~ — all three were completed on 2026-08-09; see the block below. The read-only
  half of the audit is now **7 of 7** and complete. Propagation still waits on PR #6, so the item
  stays `[~]`.
- `isSuperAdmin` (the `e0e509c` fix): **does not apply.** The identifier does not appear anywhere in
  Guides, nabu, or sortalizer `src/`. It exists only in NebulaKit (`app.d.ts`, `auth-guards.ts`,
  `stats-guard.ts`), so the guard-divergence it fixed cannot occur in the siblings.
- Admin-users PII masking: **already present** in Guides and sortalizer — both use `requireAdmin`
  plus `isPiiRevealed`/`maskEmail`/`maskGeneric`, matching NebulaKit. **nabu is not exposed and needs
  no port:** it has no `pii-mask.ts` but gates all three admin-users endpoints on `requireOwner`,
  which is strictly stronger than NebulaKit's `requireAdmin`-plus-mask (nabu's own `auth-guards.ts`
  defines `requireAdmin` as owner-or-admin and `requireOwner` as owner-only). The residual difference
  is that NebulaKit masks by default even for the owner until an explicit reveal cookie is set; that
  is a hardening delta, not a leak.
- Destructive reset and authentication-key administration: **owner-gated in all four repositories.**
  No gap.
- **Open finding — Guides only.** `Guides/src/routes/api/admin/users/[id]/+server.ts` guards PATCH
  and DELETE with an inline `if (!locals.user.isOwner && !locals.user.isAdmin)`, so **any admin can
  promote an arbitrary user to admin or delete users.** NebulaKit restricted both handlers to
  `requireOwner` in `924a5ac` ("Retire the template workflow; harden auth and the OAuth write path"),
  and nabu and sortalizer both use `requireOwner` there. Guides is the only outlier and never
  received the change — the sole commit touching that file is `4aefa9c`, unrelated. Verified not a
  false positive: `Guides/src/hooks.server.ts` adds no route guard (it only populates `locals.user`,
  with `isAdmin: is_admin === 1 || isOwner`), and no `+layout.server.ts` covers `src/routes/api`. The
  only limits are the self-modification check and the KV `setup:complete` owner-email check, so a
  non-owner admin can still escalate any other account.
- The sibling `search/` and `[id]/` endpoints in Guides and sortalizer use inline
  authenticate-then-authorize blocks rather than the shared `auth-guards` helpers. Behaviour was read
  and matches `requireAdmin` in every case checked, so this is a divergence risk rather than a
  defect — the same class of drift that `93bf6aa` caused in NebulaKit.
- Guides is checked out on `cursor/guides-main-security-20260808` with a clean tree, but that branch
  is **empty**: `git log main..HEAD` and `git diff --stat main...HEAD` both return nothing. It does
  not already carry this fix.

Sibling audit, remaining three P0 items, read-only pass on 2026-08-09 (fifth session). Still no
sibling-repository file staged, edited, or committed — every result below is from reading source.

- **Sanitize-before-`{@html}`: no gap, and the scope of that claim is every `{@html}` in each repo,
  not a sample.** sortalizer has no `src/lib/cms/` and no `{@html}` anywhere, so it is not exposed.
  nabu covers both halves of the AGENTS.md rule: `sanitizeContentFields` on create (`cms.ts:142`)
  and update (`cms.ts:343`), and again at the render boundary in
  `[contentType]/[slug]/+page.server.ts:60`, so the raw-looking `{@html item.fields.body}` in its
  `+page.svelte` receives already-sanitized fields. Guides has **no HTML sanitizer and no `xss`
  dependency at all**, which looks alarming and is not: it has exactly three `{@html}` sites, and
  all three are safe by construction. Two render `renderMarkdownToHtml`, a hand-rolled renderer that
  escapes its entire input first (`markdown.ts:147`) and routes every href through `sanitizeHref`;
  the third is a hardcoded SVG string literal (`profile/+page.svelte:214`). Guides stores Markdown
  where NebulaKit stores rich-text HTML, so the NebulaKit sanitizer does not apply to it — different
  content model, not a missing fix.
- **One-time OAuth state: no gap.** All four repositories persist an `oauth_transactions` row and
  consume it with a single atomic statement — `UPDATE ... WHERE id = ? AND provider = ? AND
consumed_at IS NULL AND datetime(expires_at) > CURRENT_TIMESTAMP RETURNING intent, user_id,
session_id` — then reject intent mismatch and, for `link`, require the row's `session_id` to match
  the hash of the caller's live session. Only the packaging differs: nabu keeps it at
  `src/lib/server/oauth-state.ts` rather than `src/lib/utils/`, and sortalizer ships a single
  `migrations/schema.sql` instead of numbered files, so its table is there rather than in an
  `oauth_transactions` migration. **A first pass called sortalizer's expiry check missing; that was a
  false positive** — a truncated `grep` had cut the `datetime(expires_at)` line, which is present.
- **Open finding — nabu only. `vite.config.ts` excludes `src/hooks.server.ts` from coverage**
  ("Hooks are tested implicitly through integration tests"), which is precisely the P0 item
  NebulaKit closed. NebulaKit, Guides, and sortalizer all measure it. The exclusion matters more in
  nabu than the same line would elsewhere: nabu's `handle` is `sequence(authHandler)`, so that one
  file **is** the entire authorization boundary, where NebulaKit's is one handler of four. It is not
  untested — `tests/unit/hooks-owner-admin.test.ts` covers owner-not-demoted, non-owner demoted,
  non-owner promoted, and a forged cookie — but its harness supplies `DB: { prepare }` in all four
  cases, so the `if (!db) throw new Error('Session database unavailable')` fail-closed branch is
  exercised by nothing, and the 95% floor cannot notice, because the file is not measured. That
  branch is the AGENTS.md rule "auth fails closed when D1 … is unavailable." Severity is below the
  Guides escalation — no live privilege gap was found — but the gate that would catch one is off.
  The fix is deleting one line, and it belongs in a nabu branch.
- Not claimed: no sibling test suite or coverage run was executed. These are source-reading results,
  so the nabu conclusion is "that branch has no test that reaches it and no gate measures the file,"
  not a measured coverage percentage.
