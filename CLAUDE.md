# Claude Instructions

**Refer to [AGENTS.md](AGENTS.md) for the canonical constraints and rules.**

This file is for Claude-specific context only. All tool-agnostic rules (testing, migrations, theming, etc.) are documented in AGENTS.md.

## Context Loading

Claude loads the first 200 lines of memory files automatically. AGENTS.md is designed to fit within that budget to ensure all critical rules are loaded on session start.

## Task Tracking

Claude has access to the `manage_todo_list` tool for tracking multi-step work. Use it to:
- Break complex work into actionable steps
- Mark tasks in-progress before starting
- Mark tasks completed immediately after finishing (not in batches)
- Provide visibility into progress for users

---

For all development constraints, coverage rules, migration policies, and theming requirements, see [AGENTS.md](AGENTS.md).
