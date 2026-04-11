# CLAUDE.md - Instructions for Claude Code and AI Assistants

## Initial Template Customization Gate

Before handling the first substantial request in a fresh repository session, check `INITIAL_CUSTOMIZATION_STATUS.md`.

- If `status: pending`, recommend `docs/INITIAL_CUSTOMIZATION.md` before feature work.
- If the user is asking to perform that customization, proceed with it.
- After the branding and documentation cleanup is done, update `INITIAL_CUSTOMIZATION_STATUS.md` to `status: complete` so future sessions do not repeat the reminder.

The template includes NebulaKit branding, default sharing assets, and template documentation links that should usually be replaced early.

## Temporary / Scratch Files

**Always use the `.llm-outputs/` directory for any temporary local files** (test output logs, coverage dumps, debug traces, scratch notes, etc.). This folder is in `.gitignore` so nothing placed there will end up in the repository.

- **DO**: Write command output, test results, coverage reports, or any other throwaway files to `.llm-outputs/`
- **DO NOT**: Create `.txt`, `.log`, or other scratch files in the project root or any other tracked directory
- The folder already exists with a `.gitkeep`; just drop files directly into it

## Database Migrations - MANDATORY RULES

**NEVER modify migration files that have already been committed to `main`.**

Migration files in `migrations/` are immutable once applied. Cloudflare D1 tracks applied migrations by filename in a `d1_migrations` table. Editing an applied migration will cause checksum mismatches, deployment failures, and potential data loss.

### When you need to change the database schema:

1. Find the highest-numbered migration in `migrations/`
2. Create a NEW file: `migrations/NNNN_description.sql` (next number in sequence)
3. Use `ALTER TABLE` to modify existing tables
4. Test with `npm run db:migrate:local`

### Never do this:

- Edit `migrations/0001_initial_schema.sql` or any other existing migration
- Delete or rename migration files
- Reorder migrations
- Drop tables without explicit user approval

See `migrations/README.md` for the full migration guide.

## Code Coverage - MANDATORY RULES

**Code coverage must NEVER drop below 95%. This is a hard floor.**

- Before completing any task, run `npm run test:coverage` and confirm overall coverage is ≥ 95%
- If your changes reduce coverage below 95%, you MUST write additional tests before finishing
- 100% coverage is required on critical paths (auth, payments, data mutations)
- Every new feature, bug fix, or refactor must include tests sufficient to maintain this threshold
- Do NOT skip tests to save time — untested code is incomplete code

### Verification command:

```bash
npm run test:coverage
```

Check the summary output. If any category (Statements, Branches, Functions, Lines) falls below 95%, add tests until the threshold is met.
