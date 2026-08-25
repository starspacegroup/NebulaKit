---
status: pending
app_name: NebulaKit
branding_updated: false
share_assets_updated: false
template_documentation_removed: false
credential_fields_unique: false
last_updated: 2026-04-11
---

# Initial Customization Status

This file is the shared source of truth for humans and AI assistants.

## Current State

- Status: pending
- App name: NebulaKit
- Branding updated: no
- Share assets updated: no
- Template documentation removed or replaced: no
- Credential fields unique: no

## How To Finish This

1. Follow [docs/INITIAL_CUSTOMIZATION.md](docs/INITIAL_CUSTOMIZATION.md).
2. Update the frontmatter in this file when the template-level cleanup is done.
3. Change `status` to `complete` once the branding and documentation work is finished.

## Notes

- `credential_fields_unique` tracks whether `site.slug` is this product's own slug.
  Every auth and secret form field derives its `id`/`name` from it (see
  [src/lib/utils/form-fields.ts](src/lib/utils/form-fields.ts)), so while the slug is
  still `nebulakit` this site shares field names with every other unconfigured site
  from the template, and a password manager can offer the wrong credentials.
  `bun run customize` sets both the slug and this flag.

- Keep this file in the repository so future sessions can detect whether the template onboarding work still needs to be done.
- If you intentionally postpone the cleanup, leave `status: pending` so assistants continue to recommend it.
