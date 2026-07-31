# Cloudflare setup (D1 / KV / R2)

**Every project gets its own resources. Never paste an id from another project.**

## Why this page exists

Cloudflare binds D1 and KV by **id**. `database_name` in `wrangler.toml` is a
label wrangler never checks against your account — so if you copy another
project's `database_id`, every query succeeds and reads somebody else's data.
There is no error, no warning, nothing in the dashboard that looks wrong.

A wrong _name_ is loud: `wrangler d1 migrations apply <name>` fails immediately.
A wrong _id_ is silent.

This template used to ship **real** ids. Six projects derived from it inherited
the same `database_id`, the same KV `id`, and the same KV `preview_id`:

| project             | what it thought it had | what it actually bound |
| ------------------- | ---------------------- | ---------------------- |
| NebulaKit           | `nebulakit-db`         | `nebulakit-db`         |
| Guides              | `guides-db`            | `nebulakit-db`         |
| Atlas               | `nebulakit-db`         | `nebulakit-db`         |
| arizona-nebulakit   | `nebulakit-db`         | `nebulakit-db`         |
| convey.land/app     | `convey-land-db`       | `nebulakit-db`         |
| convey.land/app-new | `convey-land-db`       | `nebulakit-db`         |

The result: one D1 with 28 tables and four projects' migrations interleaved in a
single `d1_migrations` table, numbering collided (two `0004`s, two `0005`s…).
D1 tracks applied migrations **by filename**, so every one of them "succeeded".

The sharper problem was KV, not D1. That one shared namespace held
`auth_config:github`, `ai_keys_list` and a `github_sync_pat` — OAuth secrets and
a GitHub personal access token that all six projects could read and overwrite.

Guides additionally set `preview_database_id` to the _production_ id, so even
`wrangler dev` wrote into production.

## Setup for a new project

```bash
bun run setup:cf           # creates D1 + KV + KV preview, writes the ids in
bun run db:migrate         # create the tables
```

`setup:cf` names the database after your project (`<slug>-db`, taken from
`name` in `wrangler.toml` or passed as an argument), creates the three
resources, writes their ids over the `REPLACE_ME_*` placeholders, and then runs
`check:bindings` to confirm the result. It exists because the remaining risk
after placeholders is the human step — creating four resources and pasting four
ids into the right four lines is exactly where the mistake above came from.

It will not guess. If wrangler's output cannot be parsed into exactly one id of
the right shape, or if wrangler fails, `wrangler.toml` is left untouched and you
get the raw output to paste by hand. It also refuses to overwrite ids that are
already real unless you pass `--force`, so re-running it on a live project
cannot silently point the app at a fresh, empty database. `--dry-run` shows the
commands without running them.

<details>
<summary>By hand instead</summary>

```bash
wrangler d1 create <project>-db
wrangler kv namespace create "KV"
wrangler kv namespace create "KV" --preview
wrangler r2 bucket create <project>-files    # only if you use R2
```

Paste each returned id into `wrangler.toml`, replacing the `REPLACE_ME_*`
placeholders, and set `database_name` to match the database you just created.
Then:

```bash
bun run check:bindings     # must print "ok" before anything else will run
bun run db:migrate
```

</details>

## The database name

`db:migrate` reads `database_name` from `wrangler.toml` rather than hardcoding
one. These scripts used to say `nebulakit-db` — the template's own database —
so a derived project either failed outright or, if it still had the leaked id in
place, applied its migrations **into the shared database**. That is how one D1
ended up with four projects' migrations interleaved. Name and id now come from
the same file, so they cannot disagree.

## The guard

`scripts/check-bindings.mjs` runs automatically before `dev`, `build`,
`db:migrate` and `db:migrate:list`. It fails the command — it does not warn —
on any of:

1. a `REPLACE_ME_*` placeholder still in place,
2. a **quarantined** id (one of the three this template leaked; those are
   hard-coded in the script and are never legitimate in a derived project),
3. `preview_id === id`, or `preview_database_id === database_id` — the aliasing
   that sends dev writes into production.

Point it at any config to audit another repo:

```bash
node scripts/check-bindings.mjs ../other-project/wrangler.toml
```

Warnings were not enough here — the original template _did_ carry a comment
saying "replace the database_id below with the actual ID", and six projects
skipped it anyway. That is why this exits non-zero.

## Account limits worth knowing

- **D1 is capped at 10 databases per account on the free plan** (`code: 7406`,
  "System limit reached: databases per account"). The personal account
  (`7170…77aa`) is at that cap, so a new project there needs a freed slot, a
  different account, or Workers Paid.
- **R2 is not enabled on the \*Space account** (`f6de…c344`, API error `10042`).
  Projects that bind R2 can't move there until it's switched on in the
  dashboard.
