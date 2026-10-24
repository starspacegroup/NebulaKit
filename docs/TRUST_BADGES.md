# Trust badges a visitor can check

A trust badge is only worth showing if the reader can click it and see the proof. Agreed 2026-10-24.

## Which checks

| Check | What it shows | Public report |
|---|---|---|
| SSL Labs | TLS configuration grade | https://www.ssllabs.com/ssltest/analyze.html?d=HOST |
| Mozilla HTTP Observatory | security headers grade | https://developer.mozilla.org/en-US/observatory/analyze?host=HOST |
| PageSpeed Insights | performance / accessibility / best practices / SEO scores | https://pagespeed.web.dev/analysis?url=URL |
| Accessibility | an automated WCAG scan (for example the Lighthouse accessibility score or WAVE) | the tool's report URL |
| security.txt | a way to report security problems (RFC 9116) | https://HOST/.well-known/security.txt |
| HSTS preload | the domain is on the browser preload list | https://hstspreload.org/?domain=HOST |

## Rules

1. **Show a badge only when the result is good.** Decide the bar first (for example SSL Labs A or
   better, PageSpeed 90+). Below the bar, fix the site; do not show the badge.
2. **Every badge links to its live report** so the reader can check it now.
3. **Every badge shows the date it was measured.** Hide it when it gets old (90 days is a sensible
   default) and re-measure.
4. **Never use a vendor's logo or name as an endorsement.** "Hosted on Cloudflare" with their logo is
   not a trust signal you own. Use plain text labels.
5. **Never invent a certification.** No "SOC 2", "GDPR certified", "100% secure" unless there is a
   real, current, linkable document.
6. Results are data. Keep them in one file (YAML or TS) with `label`, `reportUrl`, `measuredOn`,
   `passed`, and render from it.

## In NebulaKit

`src/lib/components/TrustBadges.svelte` renders the strip; `src/lib/seo/trust-badges.ts` holds the
rules. `visibleTrustChecks()` keeps only checks that passed, have an https report URL, a valid
`YYYY-MM-DD` date not in the future, and are no older than `maxAgeDays` (default 90).
`trustChecksNeedingWork()` returns the rest, for an admin view or a CI step.

```svelte
<script lang="ts">
	import TrustBadges from '$lib/components/TrustBadges.svelte';
	const checks = [
		{
			label: 'SSL Labs A+',
			reportUrl: 'https://www.ssllabs.com/ssltest/analyze.html?d=example.com',
			measuredOn: '2026-10-24',
			passed: true
		}
	];
</script>

<TrustBadges {checks} />
```

The kit does not run the checks for you. `docs/LIGHTHOUSE_MONITORING.md` covers the Lighthouse side.
