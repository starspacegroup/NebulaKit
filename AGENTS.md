# NebulaKit Constraints & Rules

**Canonical source of truth for all AI assistants working on this codebase.**

## Critical Constraints

### 1. Test-Driven Development — Coverage Floor at 95%

**Failure mode:** Code shipped without tests; coverage dropped; defects in critical paths.

**Rule:** Every feature, bug fix, or refactor must include tests first. Coverage must **NEVER** drop below 95% — this is a hard floor.

**When this breaks:**
- Changes reduce coverage below 95% → Add tests until threshold is met. Do not ship without them.
- Forgetting to verify coverage → Run `npm run test:coverage` before finishing any task.
- Skipping critical path tests → Auth, payments, data mutations require 100% coverage.

**Workflow:** See [tests/](tests/) for structure. Tests live alongside source code (`.test.ts` files).

### 2. Database Migrations — Immutable Once Committed

**Failure mode:** Edited applied migration → D1 checksum mismatch → deployment failure.

**Rule:** Never modify a migration file that exists on `main`. Create a new migration instead.

**When this breaks:**
- New schema change needed → Create `migrations/NNNN_description.sql` (next sequence number).
- Migration already exists → Use `ALTER TABLE` in a new migration file, not edits to the original.
- Deployed to production → Contact infrastructure; never retroactively edit applied migrations.

**Reference:** [migrations/README.md](migrations/README.md)

### 3. CSS Variables — No Hardcoded Colors

**Failure mode:** Hardcoded `#hex`, `rgb()`, or named colors → Breaks theming; accessibility failures.

**Rule:** All colors must use CSS custom properties from [src/app.css](src/app.css) (e.g., `var(--color-primary)`).

**When this breaks:**
- Hardcoded color found → Replace with `var(--color-*)`. Never hardcode.
- New color needed → Add to [src/app.css](src/app.css) with light/dark theme values first.
- Contrast fails → Run `npm run validate-theme-contrast` and adjust theme variables.

**Reference:** [docs/THEME_SYSTEM.md](docs/THEME_SYSTEM.md)

### 4. Scratch Files Go to `.llm-outputs/`

**Failure mode:** Test logs, coverage dumps, debug traces committed to git.

**Rule:** All temporary files go to `.llm-outputs/` (already in `.gitignore`).

**When this breaks:**
- Temp file created → Move to `.llm-outputs/` before committing.
- No `.llm-outputs/` folder → It exists; use it.

### 5. Initial Customization Gate

**Failure mode:** New sessions recommend branding cleanup repeatedly.

**Rule:** On first substantial request, check [INITIAL_CUSTOMIZATION_STATUS.md](INITIAL_CUSTOMIZATION_STATUS.md).
- If `status: pending` → Recommend [docs/INITIAL_CUSTOMIZATION.md](docs/INITIAL_CUSTOMIZATION.md) workflow.
- If `status: complete` → Proceed normally.
- After completing customization → Update status to `complete` with real app name.

---

## Architecture Notes

- **Cloudflare-first:** D1 (DB), KV, R2, Queues, Workers AI. See [wrangler.toml](wrangler.toml).
- **Minimal dependencies:** Build features in-house. External packages only for complex/unsolvable cases.
- **SvelteKit + TypeScript:** Always use types. Never suppress TypeScript errors.
- **TDD cycle:** Red → Green → Refactor. Repeat for each feature.

---

*Every rule exists because something broke. If you find an undocumented failure, document it here.*
