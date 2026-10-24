# Cold outreach email

Rules from the davis9001.com outreach work of 2026-10-24 (`src/lib/server/outreach.ts`,
`outreach-resend.ts`, `docs/outreach-email-best-practices.md` in davis9001.com-sveltekit, which has the
sources). Copy them when a project sends first-contact email.

## Copy

- 50 to 125 words. Plain words, about a fifth-grade reading level.
- Open with one specific, checkable fact about the reader (their site, a measured fault), not a
  self-introduction or "I hope this finds you well".
- More "you" than "I".
- State measured facts ("the home page took 6.2 s to load on mobile"), not vague claims ("your site
  is slow").
- One interest-based question ("Want me to send what I saw?"), not a meeting request.
- No exclamation marks, no hype or urgency words, no money bait.
- Subject: 2 to 5 words, honest, names their site. Never a fake "Re:".

## Follow-ups

- At most two follow-ups (three emails), in the same thread, about day 4 and day 10, then stop.
- Each follow-up adds new value (a finding, a concrete offer). Never "just checking in".

## AI-drafted email

If a model drafts the text, validate it in code before sending. Reject a draft that has an
exclamation mark, a stock opener, a hype word, more "I" than "you", a word count out of range, or
not exactly one question.

## Delivery

- Plain text. No tracking pixel, no click tracking (turn both off in the sending provider).
- No links in the body; the only link is the opt-out.
- `List-Unsubscribe` header, a working opt-out honoured within 2 days, and a real postal address in
  the footer (CAN-SPAM, applies to B2B too).
- DNS: SPF and DKIM for the sending domain, and a DMARC record. Start DMARC at `p=none` during
  warm-up and read the reports before you tighten it.
- Verify addresses first; keep bounces under 2% and spam complaints under 0.3%.
- Warm up slowly: about 10 a day, rising to 30 to 40.
