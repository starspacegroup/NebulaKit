# Copy guide: landing and sales pages

Lessons from the davis9001.com copy pass of 2026-10-24 (davis9001.com-sveltekit, commit 1398460).
They apply to any page whose job is to make a stranger take one step.

## The rules

1. **The headline says who the page is for and what they get.** Not what you are, not a slogan.
   Test: could a reader repeat back who it is for after five seconds?
2. **The subhead gives specifics a reader can check.** Numbers, scope, price, time, a named thing.
   "Fixes in 48 hours, flat $X" can be checked. "Fast, affordable, modern" cannot.
3. **One main call to action.** One primary button above the fold. Secondary links are fine, but
   they must look secondary.
4. **The CTA continues the promise that brought the reader here.** If an email or ad offered a free
   check, the first button is the free check, not "Book a call" or "Buy". Free before paid.
5. **Short, plain sentences.** One idea per sentence. Common words. More "you" than "we" or "I".
6. **The meta description matches the page's offer.** It is the line people read in search results
   and link previews. If the page changed its offer, the description changes in the same commit.
7. **Remove any claim you cannot show.** No "trusted by hundreds", "industry-leading", "best",
   no invented numbers, no logos of companies that did not agree to it.
8. **Leave a TODO instead of inventing proof.** If a section needs a testimonial, a case study or a
   number you do not have, write `TODO(owner): real quote from a named client` and ship without it.
   An empty slot is honest; a made-up one is a liability.

## Before you ship a copy change

- [ ] Headline: audience + outcome.
- [ ] Subhead: at least one checkable specific.
- [ ] Exactly one primary CTA, and it matches the inbound promise.
- [ ] No sentence over about 25 words in the hero.
- [ ] `<title>` and meta description match the new offer.
- [ ] Every claim is true today and you could show the evidence.
- [ ] Structured data (FAQ, product, organization) still matches the visible text word for word.
- [ ] Before and after screenshots saved with the change (light and dark if the site has both).
