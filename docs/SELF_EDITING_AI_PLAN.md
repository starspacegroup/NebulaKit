# Self-editing AI — plan

**Status:** plan, 2026-10-26. Requested by David: this is to become a core NebulaKit feature, built in to every site made from the kit.

**The feature:** the owner of a NebulaKit site can change the site by talking to it. The owner drags a box over part of the live site, then says or types what to change. The AI shows a preview of the change. The owner applies it, and can undo it.

Mockups are in [`docs/design/self-editing-ai/`](./design/self-editing-ai/). The site set is `nebulakit-1.png` … `nebulakit-5.png`. The Calculator and Apollo sets show the same flow in other apps.

## Decisions already made

- **One way to point: drag a box.** The owner drags a box over an area. A screenshot of that area goes to the AI with the request. There is no element picker and no "Pick" button. David, 2026-10-26: the others are too complicated.
- **Owner only.** The entry button shows only to the owner, and the server refuses every change request from anyone else. Hiding the button is not the security.
- **Preview before apply.** Nothing changes until the owner applies it. The preview starts by saying what the AI thinks was selected ("You selected the hero headline"). The owner can correct that before the change is planned.
- **Undo always.** Each applied change is a version. Undo makes a new version that restores the old state, so history is never lost.

## The flow (matches the mockups)

1. **Entry.** A small "Change this site" button and a keyboard shortcut, shown only to the owner.
2. **Drag.** The page dims. The owner drags a box with handles over any area. A size label shows. Esc cancels.
3. **Ask.** A compact input opens under the box. It shows a thumbnail of the selected area, a text field and a mic, which uses the kit's existing realtime voice.
4. **Preview.** The AI states what it thinks was selected. The page then shows the change in dashed outline, in place. A short diff sits below, with Apply / Change it / Cancel.
5. **Applied.** The change is live. One line reads "Applied · <what changed> · v<n> · Undo".

## Two kinds of change

Changes fall into two tiers. The AI must say which tier a request is in, and it never moves a request to a higher tier without asking.

**Tier 1 — content and settings (instant).** Text, images, CMS entries, FAQ items, navigation labels, theme tokens and feature toggles. These are already data in D1/KV/R2, so the change is a database write with a version row. The preview renders from a draft copy of the data. Apply copies the draft to live. Most owner requests should land here.

**Tier 2 — code and layout (through git).** Anything that needs new markup, components or routes. The flow:
- The AI writes a diff against the site's own GitHub repository.
- It pushes the diff to a branch (`ai/<version>`).
- Cloudflare Pages builds a preview deployment of that branch. The preview step shows that preview URL in a frame, with the dashed overlay.
- Apply merges the branch, which triggers the normal production deploy.
- Undo reverts the merge commit through the same path.

Tests and the existing CI checks must pass before Apply is enabled. A failing build is shown to the owner. It is never applied.

## Building blocks NebulaKit already has

- Auth with the owner bootstrap and per-user admin permissions, for the owner gate.
- The AI workspace: provider keys, streaming chat, model choice and realtime voice, for the ask step.
- The CMS and typed schemas, for most Tier 1 targets.
- The command palette, so the entry can also be a "Change this site…" command.
- The widget board, as a precedent for gestures that have a keyboard equivalent. The drag box needs one too.

## What has to be built

1. **Region capture.** A drag-to-select overlay. On release, capture that area of the rendered page as an image client-side, and record the DOM nodes under the box (their routes, component names and CMS entry ids) as hidden context. The owner never sees or picks elements, but the AI gets both the picture and the map.
2. **Source map for the AI.** At build time, emit a manifest that ties rendered regions to their source: Svelte component file and line, CMS collection and entry, theme token. This is what lets the AI say "+page.svelte line 14" and choose the right tier.
3. **Change planner.** A server endpoint, owner only, that sends the screenshot, the region context, the request and the manifest to the model. It returns a structured plan: a tier, a target, and either a data patch (Tier 1) or a code diff (Tier 2). The plan also carries a plain one-line summary for the changelog.
4. **Draft and version store.** For Tier 1, draft rows and a `site_versions` table recording who changed what, when, the before/after values and the request text. For Tier 2, branch and commit references.
5. **Preview renderer.** Tier 1 renders the page with draft data, for the owner only, marked "PREVIEW · NOT LIVE". Tier 2 frames the Pages preview deployment.
6. **Apply / undo.** A Tier 1 apply is a transactional promote. A Tier 2 apply merges through the GitHub API, using a token held in the site's secrets; the owner connects GitHub once. Undo works for both tiers.
7. **Changelog view.** An admin page listing versions, with Undo/Restore on each, and cancelled proposals kept in the list. This matches `nebulakit-5.png` and the Versions page from the earlier mockups.
8. **Keyboard and accessibility.** The drag box needs a keyboard way to select an area (focus a landmark, then expand or shrink with the arrow keys). All of it must pass the existing WCAG AA checks.

## Safety rules

- Owner only, checked on the server for every plan, preview and apply call.
- Rate limit and cost cap per day on model calls, set in admin.
- A Tier 2 diff may not touch auth, secrets, `wrangler.toml`, migrations that drop data, or this feature's own code, unless the owner confirms it by name in a second step.
- Every change is logged with the request text and the model used.
- Nothing personal or sensitive from the page goes into the screenshot. The capture masks fields that are already PII-masked in admin.
- Undo must work even if the AI provider is down: it is a database or git operation, not a model call.

## Phases

1. **Tier 1 only.** Drag, ask, preview, apply and undo for CMS text, images and theme tokens. Ship this first: it covers most requests and needs no GitHub access.
2. **Changelog and versions page**, plus the keyboard path for the drag.
3. **Tier 2 through git.** Branch, Pages preview, merge, revert.
4. **Command palette entry, voice ask, and a per-site cost dashboard.**

Each phase is test-first, as with the rest of the kit (see `docs/TDD_WORKFLOW.md`), and keeps the 95% coverage floor.

## Open questions for David

1. **Tier 2 scope at launch.** Should Tier 2 be allowed on day one for every site, or be an opt-in per site?
2. **Model.** Which model plans changes: the site's configured provider, or a fixed one?
3. **Other editors.** Should non-owner admins ever get this, for example per-permission?
4. **Templates.** Should it also work in the kit's own template repo, or only in derived sites?
