// The auction's money rules, proved, compiled to JS for packages/commerce/src/auction.ts.
// Pure arithmetic over whole cents (and milliseconds). The TS decides *whether* a bid is
// allowed (clock, status, signed-in bidder); these functions decide *what it does to the
// price*, and the lemmas say what that can never be. Conventions at the JS boundary:
//   current < 0      no bid yet           reserve < 0     no reserve
//   fixedInc <= 0    tiered increment     hasLeader=false first bid

module AuctionCore {
  const MaxExtensions: int := 50

  function Min(a: int, b: int): int { if a < b then a else b }
  function Max(a: int, b: int): int { if a > b then a else b }

  // ---- Increments ----

  function DefaultIncrement(price: int): int {
    if price < 10000 then 50          // under $100: 50 cents
    else if price < 50000 then 100    // under $500: $1
    else if price < 100000 then 500   // under $1,000: $5
    else if price < 500000 then 2500  // under $5,000: $25
    else 10000                        // $100
  }

  function IncrementAt(fixedInc: int, price: int): int {
    if fixedInc > 0 then fixedInc else DefaultIncrement(price)
  }

  lemma IncrementPositive(fixedInc: int, price: int)
    ensures IncrementAt(fixedInc, price) >= 1
  {}

  // Bigger prices never get smaller steps.
  lemma IncrementMonotone(a: int, b: int)
    requires a <= b
    ensures DefaultIncrement(a) <= DefaultIncrement(b)
  {}

  // ---- The next bid ----

  function MinimumBid(current: int, starting: int, fixedInc: int): int {
    if current < 0 then starting else current + IncrementAt(fixedInc, current)
  }

  function PriceBeforeReserve(hasLeader: bool, isLeader: bool, current: int, leaderMax: int,
                              max: int, starting: int, fixedInc: int): int {
    if !hasLeader then starting
    else if isLeader then current
    else if max > leaderMax then Min(max, leaderMax + IncrementAt(fixedInc, leaderMax))
    else if max == leaderMax then max
    else Min(leaderMax, max + IncrementAt(fixedInc, max))
  }

  function LeaderMaxAfter(hasLeader: bool, leaderMax: int, max: int): int {
    if !hasLeader then max else Max(leaderMax, max)
  }

  // A tie goes to the earlier bidder: only a strictly higher max, or the first bid, takes the lead.
  function NewLeader(hasLeader: bool, isLeader: bool, leaderMax: int, max: int): bool {
    !hasLeader || isLeader || max > leaderMax
  }

  // A leader whose ceiling clears the reserve lifts the price to it, never past it.
  function PriceAfter(hasLeader: bool, isLeader: bool, current: int, leaderMax: int,
                      max: int, starting: int, fixedInc: int, reserve: int): int {
    var p := PriceBeforeReserve(hasLeader, isLeader, current, leaderMax, max, starting, fixedInc);
    var top := LeaderMaxAfter(hasLeader, leaderMax, max);
    if reserve >= 0 && top >= reserve && p < reserve then reserve else p
  }

  // ---- What a state looks like, and which bids the TS lets through ----

  ghost predicate Valid(hasLeader: bool, current: int, leaderMax: int, starting: int) {
    starting >= 0 && (hasLeader ==> starting <= current <= leaderMax)
  }

  ghost predicate Acceptable(hasLeader: bool, isLeader: bool, current: int, leaderMax: int,
                             max: int, starting: int, fixedInc: int) {
    (isLeader ==> hasLeader) &&
    (if !hasLeader then max >= starting
     else if isLeader then max > leaderMax
     else max >= MinimumBid(current, starting, fixedInc))
  }

  // Theorem 1: an accepted bid leaves a valid state: the price is at least the starting price,
  // never falls, and never exceeds the leader's own ceiling.
  lemma BidKeepsValid(hasLeader: bool, isLeader: bool, current: int, leaderMax: int,
                      max: int, starting: int, fixedInc: int, reserve: int)
    requires Valid(hasLeader, current, leaderMax, starting)
    requires Acceptable(hasLeader, isLeader, current, leaderMax, max, starting, fixedInc)
    ensures var p := PriceAfter(hasLeader, isLeader, current, leaderMax, max, starting, fixedInc, reserve);
            var top := LeaderMaxAfter(hasLeader, leaderMax, max);
            Valid(true, p, top, starting) && (hasLeader ==> p >= current)
  {
    IncrementPositive(fixedInc, leaderMax);
    IncrementPositive(fixedInc, max);
    if hasLeader { IncrementPositive(fixedInc, current); }
  }

  // Theorem 2: the highest maximum ever placed holds the lead.
  lemma HighestMaxLeads(hasLeader: bool, isLeader: bool, leaderMax: int, max: int)
    requires isLeader ==> hasLeader
    ensures LeaderMaxAfter(hasLeader, leaderMax, max) >= max
    ensures hasLeader ==> LeaderMaxAfter(hasLeader, leaderMax, max) >= leaderMax
    ensures hasLeader && !isLeader && max <= leaderMax ==> !NewLeader(hasLeader, isLeader, leaderMax, max)
    ensures hasLeader && !isLeader && max > leaderMax ==> NewLeader(hasLeader, isLeader, leaderMax, max)
  {}

  // Theorem 3: raising your own ceiling never moves the price.
  lemma LeaderRaiseKeepsPrice(current: int, leaderMax: int, max: int, starting: int, fixedInc: int, reserve: int)
    requires starting <= current <= leaderMax && max > leaderMax
    requires reserve < 0 || current >= reserve || max < reserve
    ensures PriceAfter(true, true, current, leaderMax, max, starting, fixedInc, reserve) == current
  {}

  // Theorem 4: a challenger who loses moves the price at most one increment above their own
  // maximum (so a winner pays no more than a step over the runner-up), when there is no reserve.
  lemma LosingChallengerSetsPrice(current: int, leaderMax: int, max: int, starting: int, fixedInc: int)
    requires starting <= current <= leaderMax && max <= leaderMax
    requires max >= MinimumBid(current, starting, fixedInc)
    ensures PriceAfter(true, false, current, leaderMax, max, starting, fixedInc, -1)
              <= max + IncrementAt(fixedInc, max)
  {}

  // ... and a challenger who wins pays at most one increment over the old leader's maximum.
  lemma WinningChallengerSetsPrice(current: int, leaderMax: int, max: int, starting: int, fixedInc: int)
    requires starting <= current <= leaderMax && max > leaderMax
    ensures PriceAfter(true, false, current, leaderMax, max, starting, fixedInc, -1)
              <= leaderMax + IncrementAt(fixedInc, leaderMax)
  {}

  // Theorem 5: once the leader's ceiling clears the reserve, the price is at least the reserve.
  lemma ReserveLift(hasLeader: bool, isLeader: bool, current: int, leaderMax: int,
                    max: int, starting: int, fixedInc: int, reserve: int)
    requires reserve >= 0 && LeaderMaxAfter(hasLeader, leaderMax, max) >= reserve
    ensures PriceAfter(hasLeader, isLeader, current, leaderMax, max, starting, fixedInc, reserve) >= reserve
  {}

  // ---- Settlement ----

  function Sells(hasLeader: bool, current: int, reserve: int): bool {
    hasLeader && (reserve < 0 || current >= reserve)
  }

  // Theorem 6: a sale is at the board price, which is never above the winner's own maximum
  // and never below the reserve.
  lemma SaleIsFair(current: int, leaderMax: int, starting: int, reserve: int)
    requires Valid(true, current, leaderMax, starting) && Sells(true, current, reserve)
    ensures current <= leaderMax && current >= starting && (reserve >= 0 ==> current >= reserve)
  {}

  // ---- Soft close ----

  // A bid in the last `extendMs` of an auction moves its end to `extendMs` after the bid.
  function ExtendedEnd(endsAt: int, now: int, extendMs: int, extensions: int): int {
    if extendMs > 0 && extensions < MaxExtensions && endsAt - now <= extendMs && now + extendMs > endsAt
    then now + extendMs else endsAt
  }

  function ExtensionsAfter(endsAt: int, now: int, extendMs: int, extensions: int): int {
    if ExtendedEnd(endsAt, now, extendMs, extensions) != endsAt then extensions + 1 else extensions
  }

  // Theorem 7: the end only ever moves later, never past one window from the bid, and the
  // number of extensions can never pass the cap, so a bidding war cannot run forever.
  lemma SoftCloseBounded(endsAt: int, now: int, extendMs: int, extensions: int)
    requires extensions <= MaxExtensions && now < endsAt
    ensures ExtendedEnd(endsAt, now, extendMs, extensions) >= endsAt
    ensures ExtendedEnd(endsAt, now, extendMs, extensions) <= Max(endsAt, now + Max(extendMs, 0))
    ensures ExtensionsAfter(endsAt, now, extendMs, extensions) <= MaxExtensions
    ensures ExtensionsAfter(endsAt, now, extendMs, extensions) >= extensions
  {}

  // ---- Sequences of bids: the invariant holds however the war goes ----

  datatype Auc = Auc(hasLeader: bool, leader: int, current: int, leaderMax: int)
  datatype Bid = Bid(who: int, max: int)

  function Step(a: Auc, b: Bid, starting: int, fixedInc: int, reserve: int): Auc {
    var isLeader := a.hasLeader && a.leader == b.who;
    if !(if !a.hasLeader then b.max >= starting
         else if isLeader then b.max > a.leaderMax
         else b.max >= MinimumBid(a.current, starting, fixedInc))
    then a
    else
      Auc(true,
          if NewLeader(a.hasLeader, isLeader, a.leaderMax, b.max) then b.who else a.leader,
          PriceAfter(a.hasLeader, isLeader, a.current, a.leaderMax, b.max, starting, fixedInc, reserve),
          LeaderMaxAfter(a.hasLeader, a.leaderMax, b.max))
  }

  function Run(a: Auc, bs: seq<Bid>, starting: int, fixedInc: int, reserve: int): Auc
    decreases |bs|
  {
    if |bs| == 0 then a else Run(Step(a, bs[0], starting, fixedInc, reserve), bs[1..], starting, fixedInc, reserve)
  }

  lemma StepValid(a: Auc, b: Bid, starting: int, fixedInc: int, reserve: int)
    requires Valid(a.hasLeader, a.current, a.leaderMax, starting)
    ensures Valid(Step(a, b, starting, fixedInc, reserve).hasLeader, Step(a, b, starting, fixedInc, reserve).current,
                  Step(a, b, starting, fixedInc, reserve).leaderMax, starting)
    ensures a.hasLeader ==> Step(a, b, starting, fixedInc, reserve).current >= a.current
    ensures a.hasLeader ==> Step(a, b, starting, fixedInc, reserve).leaderMax >= a.leaderMax
  {
    var isLeader := a.hasLeader && a.leader == b.who;
    if (if !a.hasLeader then b.max >= starting
        else if isLeader then b.max > a.leaderMax
        else b.max >= MinimumBid(a.current, starting, fixedInc)) {
      BidKeepsValid(a.hasLeader, isLeader, a.current, a.leaderMax, b.max, starting, fixedInc, reserve);
    }
  }

  // Theorem 8: through any sequence of bids, the price never falls, never exceeds the leader's
  // ceiling, and the leader's ceiling only rises.
  lemma RunValid(a: Auc, bs: seq<Bid>, starting: int, fixedInc: int, reserve: int)
    requires Valid(a.hasLeader, a.current, a.leaderMax, starting)
    ensures Valid(Run(a, bs, starting, fixedInc, reserve).hasLeader, Run(a, bs, starting, fixedInc, reserve).current,
                  Run(a, bs, starting, fixedInc, reserve).leaderMax, starting)
    ensures a.hasLeader ==> Run(a, bs, starting, fixedInc, reserve).current >= a.current
    ensures a.hasLeader ==> Run(a, bs, starting, fixedInc, reserve).leaderMax >= a.leaderMax
    decreases |bs|
  {
    if |bs| > 0 {
      StepValid(a, bs[0], starting, fixedInc, reserve);
      RunValid(Step(a, bs[0], starting, fixedInc, reserve), bs[1..], starting, fixedInc, reserve);
    }
  }

  const Fresh: Auc := Auc(false, 0, -1, 0)

  // A war from an empty auction ends valid; if anyone was accepted, the winner pays at most
  // their own maximum.
  lemma WarFromFresh(bs: seq<Bid>, starting: int, fixedInc: int, reserve: int)
    requires starting >= 0
    ensures var r := Run(Fresh, bs, starting, fixedInc, reserve);
            r.hasLeader ==> starting <= r.current <= r.leaderMax
  {
    RunValid(Fresh, bs, starting, fixedInc, reserve);
  }
}
