# Database Migrations

This project uses **Cloudflare D1 migrations** with automatic tracking. D1 records which migrations have been applied in a `d1_migrations` table so they are never re-run.

## CRITICAL RULES FOR AI ASSISTANTS / LLMs

> **NEVER modify a migration file that has already been applied in production.**
>
> Applied migrations are immutable. If you need to change the schema, create a NEW migration file with the next sequence number. Editing an old migration will cause checksum mismatches, break deployments, and potentially corrupt production data.

### How to tell if a migration is "applied"

- Any migration file already committed to `main` should be treated as applied in production.
- Run `npm run db:migrate:list` to see which migrations have been applied.
- When in doubt, assume it has been applied and create a new migration instead.

### What you MUST do

1. **Create a new file** with the next sequential number: `NNNN_description.sql`
2. **Use `ALTER TABLE`** to modify existing tables, not `CREATE TABLE`
3. **Use `IF NOT EXISTS` / `IF EXISTS`** guards where appropriate
4. **Keep migrations small and focused** - one logical change per file

### What you MUST NOT do

- Edit or delete any existing migration file (e.g., `0001_initial_schema.sql`)
- Reorder or renumber migration files
- Combine multiple migrations into one
- Add `DROP TABLE` without explicit user confirmation
- Modify the `d1_migrations` tracking table

## File Naming Convention

```
NNNN_short_description.sql
```

- `NNNN` = zero-padded sequence number (0001, 0002, 0003, ...)
- `short_description` = lowercase snake_case description of the change
- Examples:
  - `0001_initial_schema.sql`
  - `0002_add_user_preferences.sql`
  - `0003_add_index_on_email.sql`

## Commands

```bash
# Apply all pending migrations to remote D1
npm run db:migrate

# Apply all pending migrations to local D1
npm run db:migrate:local

# List migrations and their status (applied / pending)
npm run db:migrate:list
```

## How It Works

Cloudflare D1's built-in migration system:

1. Reads all `.sql` files from the `migrations/` directory
2. Sorts them by filename (sequential numbering)
3. Checks the `d1_migrations` table to see which have already been applied
4. Applies only the pending migrations in order
5. Records each successful migration in `d1_migrations`

Migrations that have already run are **skipped automatically** - they will never execute twice.

## Creating a New Migration

1. Find the highest existing migration number
2. Create a new file with the next number: `migrations/NNNN_your_change.sql`
3. Write your SQL (ALTER TABLE, CREATE TABLE, CREATE INDEX, etc.)
4. Test locally: `npm run db:migrate:local`
5. Verify: `npm run db:migrate:list`
6. Commit and deploy

## Current Migrations

| File                           | Description                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `0001_initial_schema.sql`      | Base tables: users, sessions, oauth_accounts, chat_messages, indexes                |
| `0007_page_view_stats.sql`     | Page-view aggregate counters: daily, hourly, referrer, country, audience dimensions |
| `0008_platform_usage.sql`      | Daily billable-request counters for the Cloudflare plan-limit meter                 |
| `0009_user_can_view_stats.sql` | `users.can_view_stats` — per-admin grant for the Stats section                      |
