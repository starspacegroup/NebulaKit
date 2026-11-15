# Public sign-in

`site.publicSignIn` in `src/lib/site.config.ts` decides whether visitors are
invited to sign in. Rule and tests: `src/lib/public-sign-in.ts`,
`tests/unit/public-sign-in.test.ts`.

|                                                                        | `publicSignIn: true` (default, and unset) | `publicSignIn: false` |
| ---------------------------------------------------------------------- | ----------------------------------------- | --------------------- |
| Sign In / Sign Up in nav, footer, command palette, home page           | shown                                     | removed               |
| `/auth/signup`, `POST /api/auth/signup`                                | work                                      | 404                   |
| `/auth.md` lists sign-up                                               | yes                                       | no                    |
| `/auth/login`, Discord/GitHub OAuth, callbacks                         | work                                      | work, unlinked        |
| `/admin` when signed out                                               | redirects to `/auth/login`                | same                  |
| `X-Robots-Tag: noindex, nofollow, noarchive` on `/auth*`, `/api/auth*` | always                                    | always                |

Set it to `false` for a shop, a portfolio, or any site where only admins sign
in. `bun run customize` asks. Unset means `true`, so a site built before the
flag keeps its links until it opts in.

## Why: pinfool.com, 2026-11-15

pinfool.com (a shop on this template) was registered on 2026-11-14. The next
day Chrome showed a red "Dangerous site" page when the owner signed in with
Discord, on `/api/auth/discord/callback?code=…&state=…&iss=…`. Search Console
listed one security issue, "Deceptive pages", with no sample URLs. The home page
did not trigger the warning.

Google does not say why a site is flagged. What was true of the site:

- The domain was one day old.
- Every page linked a password form and Discord/GitHub sign-in buttons, on a
  shop whose customers never sign in.
- The product catalogue (novelty pins) is full of phishing words: "scam
  master", "the african prince e-mailed me", "i have a free gift for you",
  "bot account". That is not something to change, but it adds to the score.

This change removes the part we control and do not need. It does not prove the
cause, and it does not clear a flag already set: that takes a review in Search
Console.

## Checklist for a new site

1. Day one: verify the domain in Google Search Console (DNS TXT record) and
   keep it verified. A Safe Browsing flag shows there, under Security issues,
   and the review request is made there.
2. A shop or any admin-only site: `publicSignIn: false` before the first
   deploy.
3. Admins sign in at `/auth/login`, typed or bookmarked. Do not link it from
   public pages, the sitemap, or agent-discovery files.
4. Keep `/auth/` and `/api/` in robots.txt Disallow (the template does this).
   The `X-Robots-Tag` header is set by `authRobotsHandler` in
   `src/hooks.server.ts`.
5. If flagged: fix first, then Search Console → Security issues → "I have
   fixed these issues" → Request review, with a short note of what changed.
   Google documents a review time of "a few days to a few weeks", says not to
   resubmit while a request is pending, and warns that a review requested
   before the fix can slow the next one
   (<https://support.google.com/webmasters/answer/9044101>). A list without
   sample URLs does not mean no page is affected
   (<https://developers.google.com/search/docs/advanced/security/social-engineering>).
   A flag you believe is wrong can also go to the Safe Browsing error report.

Nothing official ties domain age, login forms or OAuth callbacks to the
classifier; that part is reported experience, not documentation.

## What `false` does not do

It does not stop a stranger who finds `/auth/login` from signing in with
Discord or GitHub. The OAuth callback still creates a non-admin account, as
before. Admin rights are still granted only by the existing owner/admin checks
(`src/lib/server/auth-guards.ts`), so that account can reach nothing private.
Refusing unknown OAuth identities outright would also refuse the first owner on
a fresh site; it needs its own design.
