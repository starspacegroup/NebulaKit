# Scheduled publishing

Set a CMS item to publish at a later time. In the editor, choose **Published** and fill in
**Publish at**. Leave it empty to publish now.

## How it works

There is no `scheduled` status. A scheduled item is `published` with a `published_at` that is still
in the future. Every public surface checks the date, so nothing has to run when the time arrives:
the item starts passing the check.

| Surface                  | Scheduled item                                                      |
| ------------------------ | ------------------------------------------------------------------- |
| Public list (`/blog`)    | Hidden until its time. `listContentItems` takes `liveOnly: true`.   |
| Public item page         | `404` until its time.                                               |
| Sitemap, command palette | Left out until its time (`liveSql()` in `src/lib/cms/schedule.ts`). |
| Admin list               | Shown with a **scheduled** badge. Admin APIs are not date-filtered. |

The sitemap's cache never outlives the next scheduled item: `Cache-Control: max-age` is the normal
lifetime or the seconds until the next go-live, whichever is shorter (`maxAgeFor()` in
`src/lib/cms/go-live.ts`). A post scheduled for 09:00 is in the sitemap a second after 09:00 even
with an hour-long cache, though a crawler or CDN that already holds an older copy keeps it until its
own expiry.

## Rules

- `publishedAt` on `POST /api/cms/[type]` and `PUT /api/cms/[type]/[id]` is an ISO date. `null`
  publishes now. An invalid value is a `400`.
- It is only used when `status` is `published`. A draft keeps whatever date it had.
- A scheduled item can be rescheduled, or brought forward by sending `publishedAt: null`.
- Once an item has gone live its `published_at` never moves. Locked fields, the title and slug lock,
  and the delete protection all key off that date, and they only apply once it has arrived. A
  scheduled item is still freely editable.
- A date in the past publishes immediately with that date, which is how an older post can be
  backdated.

## Timestamp proof

If a content type has `enableTimestampProof`, a proof is requested when an item goes live. For an item
published now the save request starts it. A scheduled item is saved earlier, so the proof starts the
first time anything sees it live:

- a visitor opening the item page, or
- the catch-up route `POST /api/cron/publish-scheduled` (`CRON_SECRET` bearer, like the other cron
  routes), for an item nobody has opened yet. It is a registered scheduled job (`publish-scheduled`,
  hourly at :37 by the cron Worker; see SCHEDULED_JOBS.md). Without the Worker the proof starts on the
  first visit.

Both go through `startGoLiveProof()`, which claims the item with a single conditional `UPDATE` on
`timestamp_proof_requested_at` before running the job, so the proof runs once however many callers
race. Only items that went live in the last 7 days are considered (`PROOF_CATCHUP_DAYS`): an older
item without a proof predates the type opting in, and a proof dated now would say something untrue
about when it existed.

## Code

- `src/lib/cms/schedule.ts` — date logic, `liveSql()`, and the `datetime-local` helpers.
- `src/lib/cms/go-live.ts` — the proof claim, the catch-up scan and the bounded cache lifetime.
- `src/routes/api/cron/publish-scheduled/` — the catch-up route.
- `src/lib/services/cms.ts` — create and update store the date; the list, sitemap and palette
  queries filter on it.
- `src/lib/components/CmsItemEditor.svelte` — the **Publish at** field.
