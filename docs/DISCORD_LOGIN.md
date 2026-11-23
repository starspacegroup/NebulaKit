# Discord login

One implementation, shared by the template, the marketing site and every site built on them. The
rules below came from running Discord login on PinFool and the other NebulaKit sites; each exists
because the simpler version went wrong.

## Flow

`/api/auth/discord` starts the flow (scope `identify email`, signed state, single-use transaction).
`/api/auth/discord/callback` exchanges the code, reads the Discord profile, reconciles it with an
account (`reconcileOAuthAccount`), applies the profile (`applyDiscordProfile`) and signs the person in
(`finalizeOAuthLogin`). Credentials come from `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, or the
admin Auth keys page (stored sealed in KV).

## What Discord may say about an account

All of it is decided in `src/lib/utils/discord-identity.ts` (pure, property tested).

- **Only a verified address matches an account.** Discord returns unverified addresses too; matching
  one would let anyone who registers a Discord account with a victim's email take that account over.
- **No address, no problem.** A new account without one gets `username@discord.local`, a placeholder
  that is never treated as verified and never mailed.
- **A placeholder is replaced, a chosen address never is.** On the next sign-in with a verified
  address, `@discord.local` becomes the real one. An address the person picked stays.
- **`users.email_verified_at`** is set only when Discord confirmed the address the account holds.
  Gate anything on it that must not be claimed by typing an address into a form (store credit,
  order history).
- **Avatar** is always an `https://cdn.discordapp.com` URL, built from an id and hash that look like
  Discord's own, else one of the six default avatars. It is stored in `users.github_avatar_url`
  (the column every avatar is read from) on every sign-in.
- **`users.last_login_at`** is written on every sign-in, whatever the provider.
- Every profile step fails soft: a missing picture or an unmigrated column never blocks a sign-in.

Migration `0031_user_email_verified_last_login.sql` adds the two columns. Until it runs, sign-in
still works and these two facts are simply not recorded.

## Moving a fork onto this

Forks number their own migrations, and some already have these columns, so do not copy `0031`
blindly: add only the column the fork lacks. Then replace the fork's callback with the template's and
keep fork-only behaviour (credit, orders, roles) outside it, reading `email_verified_at`.

| Site                    | State                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| nebulakit-site          | mirrors the template                                                                                 |
| PinFool                 | has these rules, inline in its callback; `discord-avatar.ts` and `credit-access.ts` are its own      |
| Nabu, 0B6OS, Spy        | close to the old template callback; adopt as is                                                      |
| Arizona, Guides         | diverged; review the diff before replacing                                                           |
| AgapeVerse, convey.land | far diverged (own merge flow, spacebot events, heartpoints); port the rules above, keep their extras |
