# Keeping `/documentation` In Sync

Companion to [AGENTS.md](../AGENTS.md) §7. This is the operational detail: what counts as a
documentable change, where it goes on the page, how to test it, and how to recreate the route if a
project deleted it during customization.

The page lives at [src/routes/documentation/+page.svelte](../src/routes/documentation/+page.svelte)
and is covered by [tests/unit/documentation-page.test.ts](../tests/unit/documentation-page.test.ts).
It is linked from [Footer.svelte](../src/lib/components/Footer.svelte) and the command palette.

## The Rule In One Line

If a user could notice the change, `/documentation` changes in the same commit.

Markdown files in `docs/` are for contributors and AI sessions. `/documentation` is what the people
using the deployed app actually read — it is the only documentation surface most of them will ever
see, so it can never lag behind the build.

## Does This Change Need Docs?

**Yes — update the page** when the change touches any of:

- A new route, page, or user-facing view.
- A new or changed step in auth, signup, setup, or owner configuration.
- A new script in `package.json` that a user or operator is expected to run.
- A new Cloudflare binding, environment variable, or secret someone must provision.
- A new integration or external service (LLM provider, payments, email, storage).
- A new keyboard shortcut, command-palette entry, or navigation affordance.
- A new admin/CMS capability, content type, or permission.
- Changed behavior of anything already documented — including defaults, limits, and error states.
- Removal or rename of any of the above.

**No — but say so** when the change is internal only: refactors, test-only changes, dependency
bumps, styling that does not change how a feature is used. Note "no user-visible change; docs
unchanged" in the commit or PR body so the omission is a decision, not an oversight.

## Where It Goes

The page is one route with anchored sections and a nav list at the top. Match the change to a
section rather than appending to the end:

| Section (`id`)        | Put this here                                                       |
| --------------------- | ------------------------------------------------------------------- |
| `start-here`          | First-run orientation and ordering of setup steps                   |
| `quick-start`         | Install/dev/build/deploy commands (both bun and npm variants)       |
| `feature-overview`    | "What you get" — one bullet per user-visible capability             |
| `how-to-use`          | Task-oriented walkthroughs for using features                       |
| `ai-workflow`         | How to work with AI assistants in this repo                         |
| `commands`            | Full script/command reference                                       |
| `cloudflare-bindings` | D1, KV, R2, Queues, Workers AI, and any new binding                 |
| `database-migrations` | Migration workflow and the immutability rule                        |
| `auth-and-setup`      | Auth providers, owner setup, session behavior                       |
| `testing`             | How to run tests and the coverage floor                             |
| `project-structure`   | Directory layout — update when adding a top-level route or lib area |
| `deployment`          | Cloudflare Pages/Workers deploy steps and required config           |
| `troubleshooting`     | Failure modes users will actually hit                               |
| `references`          | Links to repo docs and external resources                           |
| `contributing`        | Contribution pointers                                               |

A feature usually lands in **two** places: a one-line capability bullet in `feature-overview`, and
the actual instructions in `how-to-use` (or `commands` / `auth-and-setup` / `cloudflare-bindings`,
whichever fits). If a change needs a genuinely new section, add the `<section id="…">` **and** its
anchor in the `.docs-nav` list — an orphaned section is a bug.

## Procedure

1. **Test first** (AGENTS.md §1). Add assertions to `tests/unit/documentation-page.test.ts` for the
   text a user should find — a heading, a command, an instruction. Watch it fail.
2. **Write the docs** in the matching section. Prose that tells the user what to do, not a changelog
   entry. Use `<code>` for commands, paths, and env vars, consistent with the existing sections.
3. **Wire up navigation** if you added a section: nav anchor, and a command-palette entry if the
   feature has its own route (`bun run palette:scan`).
4. **Prune** anything the change made untrue — including examples and troubleshooting entries.
5. **Verify:**
   ```bash
   bun run test -- documentation-page
   bun run check
   bun run test:coverage
   ```

Style constraints that apply to this page like any other: CSS variables only, no hardcoded colors
(§3), keyboard-accessible and semantic markup, and light/dark parity.

## If The Route Doesn't Exist

Projects built from this template sometimes delete `/documentation` while stripping template
branding. That removes the template's _content_, not the requirement. Recreate the route with your
own product's documentation:

```svelte
<!-- src/routes/documentation/+page.svelte -->
<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { site } from '$lib/site.config';
</script>

<SharingMeta
	title="Documentation"
	description={`${site.name} documentation: setup, features, and deployment.`}
/>

<main class="docs-page">
	<div class="docs-container">
		<header class="docs-header">
			<h1>{site.name} Documentation</h1>
		</header>

		<nav class="docs-nav" aria-label="Documentation navigation">
			<a href="#start-here">Start Here</a>
			<!-- one anchor per section -->
		</nav>

		<section id="start-here" class="docs-section">
			<h2>Start Here</h2>
			<!-- … -->
		</section>
	</div>
</main>
```

Then restore the `/documentation` link in `Footer.svelte` and the command palette, and add a unit
test asserting the heading and at least one real instruction, so the page can never silently
disappear again.

## After Customization

Once [INITIAL_CUSTOMIZATION_STATUS.md](../INITIAL_CUSTOMIZATION_STATUS.md) is `complete`, the page
must describe **your** app: your name, your features, your deploy target. No leftover NebulaKit
references, no template repo links in `references`, no instructions for features you removed. From
that point on this document's rule takes over — every feature ships with its docs.
