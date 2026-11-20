# Auctions

Sell one unit of a product to the highest bidder. Auctions are part of
`@nebulakit/commerce` (0.4.0). A won auction becomes an ordinary order, so
payment, fulfilment and the orders API work as they do for any other sale.

## Where things are

| What                             | Where                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------ |
| The bidding rules (pure, no I/O) | `packages/commerce/src/auction.ts`                                             |
| Storage, bids, closing, orders   | `packages/commerce/src/auction-store.ts`                                       |
| Tables                           | `commerce_auctions`, `commerce_auction_bids` (migration `0026`)                |
| Public pages                     | `/auctions`, `/auctions/[slug]`                                                |
| Admin                            | `/admin/auctions` (the `shop` permission)                                      |
| The sweep that closes and bills  | `settle-auctions` job, every 5 minutes (`docs/SCHEDULED_JOBS.md`)              |
| Tests                            | `commerce-auction`, `commerce-auction-store`, `auctions-routes` (`tests/unit`) |

## How an auction works

An auction is created from a product in `/admin/auctions`. It copies the
product's name and currency, so editing the product later does not change an
auction in progress. Archive the product in `/admin/products` if it should not
also be bought at a fixed price: the shop only lists active products.

Setup options:

- **Starting price.** The first bid starts here.
- **Reserve** (optional, hidden). Below it the item does not sell. Bidders see
  only whether it has been met, never the amount.
- **Buy it now** (optional). On offer until the first bid, or, with a reserve,
  until the reserve is met.
- **Bid increment** (optional). Blank uses a tiered default: 50 cents under
  $100, then $1, $5, $25 and $100 as the price grows.
- **Extend by** seconds (optional). A bid inside the last N seconds moves the end
  to N seconds from the bid, so nobody wins by bidding in the last moment. At most
  50 extensions per auction.
- **Winner must pay within** (hours). Starts when the winner's order is made. 0 is
  no deadline, the default for the API; the admin form suggests 72. Use 0 or a
  long window if you take manual payment, because the sweep cannot tell a slow
  bank transfer from a no-show.
- **Start and end**, in UTC. An auction runs for 60 days at most.

### Proxy bidding

A bidder enters the most they will pay. The auction shows only the price needed
to stay in front, and raises it for them, one increment above the runner-up, up
to their maximum.

- The first bid sits at the starting price.
- A higher maximum takes the lead. The price becomes one increment over the old
  leader's maximum, never above the new maximum.
- A lower maximum leaves the leader in front; the price rises to one increment
  over that bid, never above the leader's maximum.
- An equal maximum loses: the earlier bid wins a tie.
- A leader may raise their own maximum (the price does not move) but not lower it.
- When the leader's maximum reaches the reserve, the price rises to the reserve.
- The winner pays the price on the board, never their maximum.

### Closing and paying

An auction ends at its end time (after any extensions). It sells if someone bid
and the reserve was met; otherwise it ends unsold. Admins can **End now** or
**Cancel** an open auction from the admin page.

The `settle-auctions` job closes ended auctions and creates one pending order
for each winner at the winning price, with the site's tax and flat shipping from
`COMMERCE_TAX_RATE_PERCENT` and `COMMERCE_FLAT_SHIPPING_CENTS`. The winner also
gets the order the moment they open the auction page, so they never wait for
the sweep. On the auction page the winner pays: with `STRIPE_SECRET_KEY` set they
go to Stripe Checkout (and the existing webhook marks the order paid); without
it the order waits for manual payment. A physical product asks for a shipping
address first.

An auction closes once and has one order. The sweep is safe to retry, and it
also repairs a sold auction whose order was never created.

### Unpaid winners and relisting

With a payment window, the sweep does two more things. About a day before the
deadline (halfway, for a window under two days) it sends one reminder. Past the
deadline it **lapses** the sale: the order is cancelled and the auction becomes
`lapsed`. The order is cancelled first and only while it is `pending`, so an
order paid a moment earlier is never cancelled and its sale stands. A crash
between the two steps is finished by the next sweep.

An unsold, lapsed or cancelled auction can be **relisted** from the admin page:
same product and terms, starting now, running as long as before, under the slug
`<slug>-r2`, `-r3`, and so on. A database index allows one open relist per
auction, so a double click cannot list it twice.

## Emails

Sent through the site's email setup (`RESEND_API_KEY`, `EMAIL_FROM`; nothing is
sent and a "skipped" row is logged without them). Each is once-only per event
through `email_log`.

| Email         | To                       | When                                                                   |
| ------------- | ------------------------ | ---------------------------------------------------------------------- |
| You won       | the winner               | the order is made (buy now, the sweep, or the winner opening the page) |
| Outbid        | the bidder who lost lead | a bid takes the lead from them (not when they are merely out-defended) |
| Pay soon      | the winner               | once, inside the reminder window                                       |
| Win cancelled | the winner               | the sale lapses                                                        |

The outbid email says the new price and the minimum to bid again, never who
outbid them or any maximum.

## Who can bid

Bidders must be signed in. The public page shows an alias ("Bidder 7F3A"), the
price and the bid count. Emails, maximums and the reserve are visible only in
`/admin/auctions`.

## Concurrency

Every bid and every closing is a compare-and-set on the auction's `version`. The
rules run against the auction as read, and the write lands only if it is still
that auction. A lost race re-reads and re-runs the rules, so two bids at the
same moment are ordered and never both applied. The bid row is written in the
same batch, only when the auction update changed a row (`changes() > 0`).

## What is proved

The arithmetic that moves money is in `dafny/AuctionCore.dfy`, verified by Dafny
and compiled to JS; `auction.ts` only checks the clock and status and passes
values in. Among the lemmas, which hold through any sequence of bids
(`RunValid`):

- the price never falls, is never below the starting price, and never exceeds
  the leader's own maximum;
- the highest maximum placed holds the lead, and a tie goes to the earlier bidder;
- raising your own maximum never moves the price;
- a challenger who loses moves the price at most one increment above their own
  maximum, and one who wins pays at most one increment over the old maximum;
- once the leader's maximum clears the reserve the price is at least the reserve;
- a sale is at the board price: never above the winner's maximum, never below
  the reserve;
- soft close only ever moves the end later, never more than one window past the
  bid, and never past the cap of 50 extensions.

Change a rule by editing the `.dfy`, then `bun run build:dafny` (needs `dafny`
4.11 on the PATH). The generated file is committed, and a test fails if it no
longer matches the `.dfy`. What is _not_ proved: the storage, the sweep and the
emails (they are tested, not proved), and `payWithinHours`, which is not money.

## Not included

- **A public API.** Auctions have pages, not `/api/v1` routes, so no API scope.
- **Quantity above one.** One auction sells one unit.
- **Second-chance offers.** A lapsed sale is relisted; it is not offered to the
  runner-up.
- **A "you lost" email** to bidders when an auction ends.
