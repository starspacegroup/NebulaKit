// The login throttle's decision rule, proved, compiled to JS for src/lib/server/login-throttle.ts.
// Pure: the TS wrapper does the KV reads/writes and passes values in. Time is epoch seconds.
// Model of KV: an IP record is live while now < its TTL expiry (KV drops it then); an email
// record carries its own fixed expiresAt, as the TS stores "count:expiresAt".

module LoginThrottleCore {
  const MaxAttempts: int := 8
  const EmailMaxAttempts: int := 64
  const WindowSeconds: int := 900
  const KvMinExpirySeconds: int := 60

  // ---- The functions the TS calls ----

  // isThrottled. emailExpiresAt <= 0 means a legacy record with no fixed expiry.
  function EffectiveEmailCount(count: int, emailExpiresAt: int, now: int): int {
    if emailExpiresAt > 0 && emailExpiresAt <= now then 0 else count
  }

  function Throttled(ipCount: int, emailCount: int, emailExpiresAt: int, now: int): bool {
    ipCount >= MaxAttempts || EffectiveEmailCount(emailCount, emailExpiresAt, now) >= EmailMaxAttempts
  }

  // recordFailure, IP side: count+1, TTL refreshed to WindowSeconds.
  function NextIpCount(ipCount: int): int { ipCount + 1 }

  // recordFailure, email side: the window is fixed at the first failure.
  function EmailLive(emailExpiresAt: int, now: int): bool { emailExpiresAt > 0 && emailExpiresAt > now }

  function NextEmailCount(count: int, emailExpiresAt: int, now: int): int {
    (if EmailLive(emailExpiresAt, now) then count else 0) + 1
  }

  function NextEmailExpiresAt(emailExpiresAt: int, now: int): int {
    if EmailLive(emailExpiresAt, now) then emailExpiresAt else now + WindowSeconds
  }

  function KvEmailExpiration(expiresAt: int, now: int): int {
    if expiresAt > now + KvMinExpirySeconds then expiresAt else now + KvMinExpirySeconds
  }

  // ---- The model the proofs run on ----

  datatype IpRec = IpRec(count: int, expiry: int)
  datatype EmailRec = EmailRec(count: int, expiresAt: int)
  datatype State = State(ip: map<string, IpRec>, email: map<string, EmailRec>)
  datatype Result = TooMany | Invalid | Ok

  function IpCount(s: State, ip: string, now: int): int {
    if ip in s.ip && now < s.ip[ip].expiry then s.ip[ip].count else 0
  }

  function EmailCount(s: State, e: string): int { if e in s.email then s.email[e].count else 0 }
  function EmailExp(s: State, e: string): int { if e in s.email then s.email[e].expiresAt else 0 }

  // One POST /api/auth/login. `good` = the right password for an existing account.
  function Attempt(s: State, ip: string, e: string, good: bool, now: int): (State, Result) {
    if Throttled(IpCount(s, ip, now), EmailCount(s, e), EmailExp(s, e), now) then (s, TooMany)
    else if good then (State(s.ip, s.email - {e}), Ok)
    else
      (State(s.ip[ip := IpRec(NextIpCount(IpCount(s, ip, now)), now + WindowSeconds)],
             s.email[e := EmailRec(NextEmailCount(EmailCount(s, e), EmailExp(s, e), now),
                                   NextEmailExpiresAt(EmailExp(s, e), now))]),
       Invalid)
  }

  datatype Req = Req(ip: string, e: string, good: bool, t: int)

  function Run(s: State, rs: seq<Req>): State decreases |rs| {
    if |rs| == 0 then s else Run(Attempt(s, rs[0].ip, rs[0].e, rs[0].good, rs[0].t).0, rs[1..])
  }

  predicate Sorted(rs: seq<Req>, from: int) {
    (forall i :: 0 <= i < |rs| ==> rs[i].t >= from) &&
    (forall i, j :: 0 <= i < j < |rs| ==> rs[i].t <= rs[j].t)
  }

  const Empty: State := State(map[], map[])

  // ---- Theorem 1: a correct password succeeds exactly when not throttled ----

  lemma GoodPasswordOkUnlessThrottled(s: State, ip: string, e: string, now: int)
    ensures Attempt(s, ip, e, true, now).1 == Ok
        <==> !Throttled(IpCount(s, ip, now), EmailCount(s, e), EmailExp(s, e), now)
    ensures Attempt(s, ip, e, true, now).1 == Ok ==> EmailCount(Attempt(s, ip, e, true, now).0, e) == 0
  {}

  // ---- Theorem 2: rate limits bound (every IP's live count <= 8, every email's <= 64) ----

  ghost predicate Bounded(s: State) {
    (forall ip :: ip in s.ip ==> 0 <= s.ip[ip].count <= MaxAttempts) &&
    (forall e :: e in s.email ==> 0 <= s.email[e].count <= EmailMaxAttempts && s.email[e].expiresAt > 0)
  }

  lemma AttemptBounded(s: State, ip: string, e: string, good: bool, now: int)
    requires Bounded(s) && now >= 0
    ensures Bounded(Attempt(s, ip, e, good, now).0)
  {}

  lemma RunBounded(s: State, rs: seq<Req>)
    requires Bounded(s) && Sorted(rs, 0)
    ensures Bounded(Run(s, rs))
    decreases |rs|
  {
    if |rs| > 0 { AttemptBounded(s, rs[0].ip, rs[0].e, rs[0].good, rs[0].t); assert Sorted(rs[1..], 0); RunBounded(Attempt(s, rs[0].ip, rs[0].e, rs[0].good, rs[0].t).0, rs[1..]); }
  }

  // A failure is only ever recorded when the IP's live count was under the limit.
  lemma FailureNeedsBudget(s: State, ip: string, e: string, now: int)
    requires Attempt(s, ip, e, false, now).1 == Invalid
    ensures IpCount(s, ip, now) < MaxAttempts
    ensures EffectiveEmailCount(EmailCount(s, e), EmailExp(s, e), now) < EmailMaxAttempts
  {}

  // ---- Theorem 3: one address cannot lock out an account ----

  // Every live email window was opened by `a`, which still holds at least that many live
  // failures, and its IP record outlives the email window.
  ghost predicate SoloInv(s: State, a: string, now: int) {
    Bounded(s) && now >= 0 &&
    (forall ip :: ip in s.ip ==> ip == a) &&
    (a in s.ip ==> s.ip[a].expiry <= now + WindowSeconds) &&
    (forall e :: e in s.email && s.email[e].expiresAt > now ==>
        a in s.ip && s.email[e].count <= s.ip[a].count && s.email[e].expiresAt <= s.ip[a].expiry)
  }

  lemma SoloInvLater(s: State, a: string, now: int, later: int)
    requires SoloInv(s, a, now) && now <= later
    ensures SoloInv(s, a, later)
  {}

  lemma EmptySolo(a: string, now: int)
    requires now >= 0
    ensures SoloInv(Empty, a, now)
  {}

  lemma SoloStep(s: State, a: string, e: string, good: bool, now: int)
    requires SoloInv(s, a, now)
    ensures SoloInv(Attempt(s, a, e, good, now).0, a, now)
  {
    AttemptBounded(s, a, e, good, now);
    var s' := Attempt(s, a, e, good, now).0;
    if !Throttled(IpCount(s, a, now), EmailCount(s, e), EmailExp(s, e), now) && !good {
      forall e2 | e2 in s'.email && s'.email[e2].expiresAt > now
        ensures a in s'.ip && s'.email[e2].count <= s'.ip[a].count && s'.email[e2].expiresAt <= s'.ip[a].expiry
      {
        if e2 != e {
          assert s.email[e2].expiresAt <= s.ip[a].expiry;
          assert now < s.ip[a].expiry;
        }
      }
    }
  }

  lemma SoloRun(s: State, a: string, rs: seq<Req>, now: int)
    requires SoloInv(s, a, now) && Sorted(rs, now)
    requires forall i :: 0 <= i < |rs| ==> rs[i].ip == a
    ensures forall t :: (|rs| == 0 ==> t >= now) && (|rs| > 0 ==> t >= rs[|rs|-1].t) ==> SoloInv(Run(s, rs), a, t)
    decreases |rs|
  {
    if |rs| == 0 {
      forall t | t >= now ensures SoloInv(s, a, t) { SoloInvLater(s, a, now, t); }
    } else {
      SoloInvLater(s, a, now, rs[0].t);
      SoloStep(s, a, rs[0].e, rs[0].good, rs[0].t);
      var s1 := Attempt(s, rs[0].ip, rs[0].e, rs[0].good, rs[0].t).0;
      var rest := rs[1..];
      assert Sorted(rest, rs[0].t);
      SoloRun(s1, a, rest, rs[0].t);
      if |rest| > 0 { assert rest[|rest|-1] == rs[|rs|-1]; }
    }
  }

  // Whatever one address `a` sends, in any order, for any emails, with any passwords, the
  // owner of any email coming from another address `b` afterwards still gets in.
  lemma SingleIpCannotLockOut(a: string, b: string, e: string, rs: seq<Req>, now: int, t: int)
    requires a != b && now >= 0 && Sorted(rs, now)
    requires forall i :: 0 <= i < |rs| ==> rs[i].ip == a
    requires (|rs| == 0 ==> t >= now) && (|rs| > 0 ==> t >= rs[|rs|-1].t)
    ensures Attempt(Run(Empty, rs), b, e, true, t).1 == Ok
  {
    EmptySolo(a, now);
    SoloRun(Empty, a, rs, now);
    var s := Run(Empty, rs);
    assert SoloInv(s, a, t);
    assert IpCount(s, b, t) == 0;
  }

  // ---- Theorem 4: the distributed lockout the policy accepts is real (8 addresses × 8) ----

  lemma EightAddressesCanLock(e: string, s: State, now: int)
    requires EmailCount(s, e) == EmailMaxAttempts && EmailExp(s, e) > now
    ensures Attempt(s, "owner", e, true, now).1 == TooMany
  {}
}
