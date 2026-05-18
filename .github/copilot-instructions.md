# GitHub Copilot Instructions for NebulaKit

**Refer to [AGENTS.md](../AGENTS.md) for the canonical constraints and rules.**

All tool-agnostic rules (testing, migrations, theming, scratch files, customization gate) are documented there. This file is for Copilot-specific context only.

## Development Environment Assumptions (Local Copilot Chat Only)

> ⚠️ **This section applies ONLY to GitHub Copilot Chat on local workstations, NOT to the Copilot Coding Agent (remote/cloud agent).**

When using Copilot Chat locally:

- Assume `npm run dev` is already running in a separate terminal on port 4277
- Do NOT start the dev server when performing tasks
- Do NOT run `npm run dev`, `vite dev`, or similar commands
- When testing locally, assume the app is already accessible at `http://localhost:4277`
- If you need to verify the app is running, check the existing terminal output rather than starting a new instance

When using the Copilot Coding Agent (remote):

- The coding agent should manage its own dev server as needed
- Normal startup commands are expected in that context

---

For all development constraints, coverage rules, migration policies, theming requirements, TDD workflows, and architecture principles, see [AGENTS.md](../AGENTS.md).
