// The checkout's money rules, proved, compiled to JS for packages/commerce/src/payment-core.ts.
// Two parts:
//   1. Amount arithmetic over whole minor units (cents, yen, fils): tax, totals, regional price.
//      Integers only, half-up rounding, never negative, never above the catalog.
//   2. The webhook state machine: what a verified Stripe event may do to an order's status.
//      A paid order never goes back, a cancelled one never comes back, and replaying an event
//      changes nothing a second time.
// Conventions at the JS boundary:
//   status:   0 pending, 1 paid, 2 fulfilling, 3 shipped, 4 delivered, 5 cancelled
//   kind:     0 paying (succeeded/completed), 1 cancelling (canceled/expired),
//             2 failed (declined card), 3 refunded, anything else ignored
//   ppm:      tax rate in millionths (8.25% = 82500), 0..1000000

module PaymentCore {
  const PPM: int := 1000000

  function Min(a: int, b: int): int { if a < b then a else b }
  function Max(a: int, b: int): int { if a > b then a else b }

  // Round a/b half up, for a >= 0 and b > 0.
  function RoundDiv(a: int, b: int): int
    requires a >= 0 && b > 0
  {
    (2 * a + b) / (2 * b)
  }

  lemma RoundDivBounds(a: int, b: int, c: int)
    requires a >= 0 && b > 0 && c >= 0 && a <= c * b
    ensures 0 <= RoundDiv(a, b) <= c
  {
    // 2a + b <= 2cb + b < 2b(c + 1), so the floor is at most c.
    assert 2 * a + b < 2 * b * (c + 1);
    DivBelow(2 * a + b, 2 * b, c + 1);
  }

  lemma MulLe(a: int, b: int, c: int)
    requires a >= 0 && b <= c
    ensures a * b <= a * c
  {
    assert a * c - a * b == a * (c - b);
    MulNonNeg(a, c - b);
  }

  lemma MulNonNeg(a: int, b: int)
    requires a >= 0 && b >= 0
    ensures a * b >= 0
  {}

  lemma DivBelow(x: int, y: int, k: int)
    requires x >= 0 && y > 0 && x < y * k
    ensures x / y < k
  {}

  // ---- Tax ----

  // Tax on a subtotal. Exclusive: subtotal * rate, added on top. Inclusive: the share of a
  // subtotal that already contains it, subtotal * rate / (1 + rate).
  function TaxOn(subtotal: int, ppm: int, inclusive: bool): int
    requires subtotal >= 0 && 0 <= ppm <= PPM
  {
    if ppm == 0 || subtotal == 0 then 0
    else if inclusive then RoundDiv(subtotal * ppm, PPM + ppm)
    else RoundDiv(subtotal * ppm, PPM)
  }

  lemma TaxBounded(subtotal: int, ppm: int, inclusive: bool)
    requires subtotal >= 0 && 0 <= ppm <= PPM
    ensures 0 <= TaxOn(subtotal, ppm, inclusive) <= subtotal
  {
    if ppm != 0 && subtotal != 0 {
      MulLe(subtotal, ppm, PPM);
      if inclusive {
        MulLe(subtotal, PPM, PPM + ppm);
        RoundDivBounds(subtotal * ppm, PPM + ppm, subtotal);
      } else {
        RoundDivBounds(subtotal * ppm, PPM, subtotal);
      }
    }
  }

  // What the customer pays. Inclusive tax is already inside the subtotal, so never added twice.
  function Total(subtotal: int, shipping: int, tax: int, inclusive: bool): int {
    subtotal + shipping + (if inclusive then 0 else tax)
  }

  lemma TotalBounds(subtotal: int, shipping: int, ppm: int, inclusive: bool)
    requires subtotal >= 0 && shipping >= 0 && 0 <= ppm <= PPM
    ensures var t := Total(subtotal, shipping, TaxOn(subtotal, ppm, inclusive), inclusive);
            subtotal + shipping <= t <= 2 * subtotal + shipping
  {
    TaxBounded(subtotal, ppm, inclusive);
  }

  // ---- Regional (PPP) price ----

  // The base price at `percent` of itself, rounded half up, but never under the floor (unless the
  // base is under it, when the base stands). Only ever lowers: 1..99 percent applies, else base.
  function RegionalUnit(base: int, percent: int, floor: int): int
    requires base >= 0 && floor >= 0
  {
    if percent < 1 || percent >= 100 then base
    else Max(RoundDiv(base * percent, 100), Min(base, floor))
  }

  lemma RegionalNeverRaises(base: int, percent: int, floor: int)
    requires base >= 0 && floor >= 0
    ensures 0 <= RegionalUnit(base, percent, floor) <= base
  {
    if 1 <= percent < 100 {
      MulLe(base, percent, 100);
      RoundDivBounds(base * percent, 100, base);
    }
  }

  // ---- The webhook state machine ----

  const Pending: int := 0
  const Paid: int := 1
  const Cancelled: int := 5

  const KindPaying: int := 0
  const KindCancelling: int := 1
  const KindFailed: int := 2
  const KindRefunded: int := 3

  // Decisions, as returned to JS.
  const Ignore: int := 0            // not for this site, or nothing to do
  const MarkPaid: int := 1          // pending -> paid
  const AlreadyPaid: int := 2       // replay of a paid event, or a later stage
  const Cancel: int := 3            // pending -> cancelled
  const AlreadyCancelled: int := 4  // replay of a cancelling event
  const NotPending: int := 5        // a cancelling event for an order already paid: ignored
  const AmountMismatch: int := 6    // money taken does not cover the order: a person looks
  const PaidButCancelled: int := 7  // money for an order this site already gave up on
  const Record: int := 8            // failed / refunded: noted, status untouched
  const NotPaid: int := 9           // a paying event whose money has not arrived

  predicate ValidStatus(s: int) { 0 <= s <= 5 }
  predicate Settled(s: int) { 1 <= s <= 4 }

  // known:      the event names this order and the payment this site recorded for it
  // moneyIn:    the provider says the money was taken (status succeeded / payment_status paid)
  // hasAmount:  the event says how much was taken
  // currencyOk: in the order's currency
  function Decide(status: int, kind: int, known: bool, moneyIn: bool, hasAmount: bool,
                  taken: int, due: int, currencyOk: bool): int
  {
    if !known then Ignore
    else if kind == KindFailed || kind == KindRefunded then Record
    else if kind == KindCancelling then
      (if status == Cancelled then AlreadyCancelled
       else if status == Pending then Cancel
       else NotPending)
    else if kind == KindPaying then
      (if !moneyIn then NotPaid
       else if !hasAmount || !currencyOk || taken < due then AmountMismatch
       else if status == Cancelled then PaidButCancelled
       else if status == Pending then MarkPaid
       else AlreadyPaid)
    else Ignore
  }

  // The status after a decision. Only MarkPaid and Cancel move anything, and only from pending.
  function Next(status: int, decision: int): int {
    if decision == MarkPaid && status == Pending then Paid
    else if decision == Cancel && status == Pending then Cancelled
    else status
  }

  function Step(status: int, kind: int, known: bool, moneyIn: bool, hasAmount: bool,
                taken: int, due: int, currencyOk: bool): int
  {
    Next(status, Decide(status, kind, known, moneyIn, hasAmount, taken, due, currencyOk))
  }

  // A settled (paid or later) order is never moved by any event: no paid -> unpaid.
  lemma NoRegression(status: int, kind: int, known: bool, moneyIn: bool, hasAmount: bool,
                     taken: int, due: int, currencyOk: bool)
    requires Settled(status)
    ensures Step(status, kind, known, moneyIn, hasAmount, taken, due, currencyOk) == status
  {}

  // A cancelled order stays cancelled, whatever arrives after.
  lemma CancelledAbsorbs(kind: int, known: bool, moneyIn: bool, hasAmount: bool,
                         taken: int, due: int, currencyOk: bool)
    ensures Step(Cancelled, kind, known, moneyIn, hasAmount, taken, due, currencyOk) == Cancelled
  {}

  // Anything that moves an order moves it out of pending, to paid or cancelled.
  lemma OnlyFromPending(status: int, kind: int, known: bool, moneyIn: bool, hasAmount: bool,
                        taken: int, due: int, currencyOk: bool)
    ensures var s := Step(status, kind, known, moneyIn, hasAmount, taken, due, currencyOk);
            s != status ==> status == Pending && (s == Paid || s == Cancelled)
  {}

  // Paid only on a known payment whose money arrived, in the right currency, covering the order.
  lemma PaidNeedsMoney(status: int, kind: int, known: bool, moneyIn: bool, hasAmount: bool,
                       taken: int, due: int, currencyOk: bool)
    ensures Step(status, kind, known, moneyIn, hasAmount, taken, due, currencyOk) == Paid && status != Paid
            ==> known && kind == KindPaying && moneyIn && hasAmount && currencyOk && taken >= due
  {}

  // Replaying the same event changes nothing a second time.
  lemma Idempotent(status: int, kind: int, known: bool, moneyIn: bool, hasAmount: bool,
                   taken: int, due: int, currencyOk: bool)
    requires ValidStatus(status)
    ensures var s := Step(status, kind, known, moneyIn, hasAmount, taken, due, currencyOk);
            Step(s, kind, known, moneyIn, hasAmount, taken, due, currencyOk) == s
  {}

  // A failed card or a refund never moves the order: a declined card is retried on the same
  // payment, and a refund is a person's decision recorded beside the order, not a new status.
  lemma RecordOnly(status: int, known: bool, moneyIn: bool, hasAmount: bool,
                   taken: int, due: int, currencyOk: bool)
    ensures Step(status, KindFailed, known, moneyIn, hasAmount, taken, due, currencyOk) == status
    ensures Step(status, KindRefunded, known, moneyIn, hasAmount, taken, due, currencyOk) == status
  {}
}
