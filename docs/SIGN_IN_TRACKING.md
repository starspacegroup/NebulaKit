# Sign-in tracking (opt-in)

Lets the owner see who is signed in, where each sign-in came from, and which attempts failed, and
sign any live session out. **Off by default.**

The rest of the template is deliberately cookie-free, identifier-free and IP-free
([ADMIN_STATS.md](ADMIN_STATS.md)). This is the one feature that stores an IP address, so it
follows the rule for anything that does: opt-in, minimal, time-limited, masked on display.

## Privacy note (what to tell your users)

When the owner turns tracking on, each attempt to sign in (password, sign-up, GitHub, Discord),
failures included, is recorded with:

| Stored                                  | Notes                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Method, worked or failed, short reason  | Reasons are fixed phrases such as "wrong password". The password is never kept. |
| IP address                              | Stored in full, **shown masked** (`203.0.x.x`) unless the owner reveals PII.    |
| Device label                            | A bucket such as "Chrome on macOS". **The raw User-Agent is never stored.**     |
| Country                                 | The two-letter code Cloudflare supplies.                                        |
| The account, when the attempt names one | A user id, not the typed email address. Unknown accounts store nothing.         |
| When a live session was last used       | `sessions.last_seen_at`, refreshed at most once every 5 minutes.                |

Not recorded: visitors who are not signing in (page views stay cookie-free), typed email
addresses, passwords, full browser strings, or anything while the switch is off.

Retention: attempts are deleted after **90 days** (as new ones are written, and by
`POST /api/cron/prune-audit`). The owner can delete everything at once ("Delete all recorded
sign-ins" also clears every `last_seen_at`). Turning tracking off stops new records immediately;
existing ones age out or can be deleted.

If you run a site with tracking on, say so in your privacy policy. A sign-in IP is personal data
in the EU and UK.

## Where the switch lives

KV key `sign_in_tracking` (`{"enabled":true,"updatedAt":"…"}`), alongside `analytics_config` and
the other owner settings. It is configuration, not a counter, so it needs no migration. The reader
**fails closed**: a missing binding, an unreadable value or a KV outage means "off".

The owner flips it at `/admin/sign-ins`. Changing it is recorded in the
[audit log](AUDIT_LOG.md).

## Hook points

- `POST /api/auth/login`: failures (`throttled`, `unknown account`, `wrong password`) and success.
- `POST /api/auth/signup`: success.
- OAuth callbacks, through `finalizeOAuthLogin`: success. A failed provider exchange is recorded
  in each callback's catch. Account-linking flows are not sign-ins and are not recorded.
- `authHandler` in `src/hooks.server.ts`: one `trackSessionSeen` call after the session resolves.
  The sequence order is unchanged.

State-mismatch redirects in the OAuth callbacks are not recorded (they carry no account and are
mostly forged or stale links).

## Guarantees

- **Never blocks a sign-in.** Every recorder catches its own errors. A missing migration, a KV
  outage or a full table cannot refuse a correct login or admit a wrong one. Recording is handed to
  `waitUntil` when the platform has one.
- **Throttled.** `last_seen_at` is written at most once per 5 minutes per session. An in-memory
  throttle runs first, so a request that is not due costs nothing, not even the KV read for the
  switch; the `UPDATE` carries its own staleness test, so separate isolates agree.
- **Off writes nothing.** No event rows, no `last_seen_at`.

## The page

`/admin/sign-ins`, **owner-only** (`requireOwner`; an ordinary admin gets 403, and the nav entry is
hidden). It shows the switch with the disclosure above, the live sessions with a "Sign out"
button for each (a revoked session stops signing anyone in on its next request), a 24-hour and
7-day summary, and the recent attempts. Email and IP are masked until the owner reveals PII with
the existing toggle.

Session revocation works whether or not tracking is on.

## Schema

Migration `0025_audit_and_sign_ins.sql`: table `sign_in_events` and column
`sessions.last_seen_at`. `user_id` is not a foreign key, so history survives deleting the account
until it ages out.
