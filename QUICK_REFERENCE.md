# NebulaKit Development Quick Reference

## 🚀 Essential Commands

```bash
# Development
bun run dev              # Start dev server (port 4277)
bun run build            # Build for production
bun run preview          # Preview production build
bun run check            # TypeScript type checking

# Testing (REQUIRED before commits)
bun run test             # Run unit & integration tests
bun run test:watch       # Watch mode for TDD
bun run test:coverage    # Coverage report (hard floor: 95%, all four metrics)
bun run test:e2e         # End-to-end tests
bun run test:all         # Run all tests

# Tunneling (expose local dev server publicly via cloudflared)
bun run tunnel           # Free quick tunnel (trycloudflare.com, no account needed)
bun run dev:tunnel       # Dev server + tunnel in one command
                         # TUNNEL_TOKEN=<token> bun run tunnel  # custom domain
                         # VITE_HMR=true bun run dev  # re-enable HMR for local-only work

# Deployment
bun run deploy           # Deploy to Cloudflare Pages
```

## ✅ Pre-Commit Checklist

- [ ] Tests written FIRST (TDD)
- [ ] `bun run test` passes
- [ ] `bun run test:coverage` shows ≥95%
- [ ] `bun run check` passes (no TS errors)
- [ ] `bun run dev` works locally
- [ ] No new external dependencies (or justified)

## 🧪 TDD Workflow

```
1. RED    → Write failing test
2. GREEN  → Minimal code to pass
3. REFACTOR → Improve quality
4. REPEAT → Next feature
```

## 📁 Project Structure

```
src/
├── lib/
│   ├── components/      # UI components + tests
│   ├── stores/          # Svelte stores + tests
│   ├── utils/           # Utilities + tests
│   ├── services/        # Business logic + tests
│   └── types/           # TypeScript types
├── routes/              # Pages & API routes + tests
└── app.css              # Global styles & theme

tests/
├── unit/                # Unit tests
├── integration/         # API & DB tests
├── e2e/                 # End-to-end tests
├── fixtures/            # Mock data
└── setup.ts            # Test config
```

## 🎯 Coding Standards

### Naming Conventions

- **Components**: `UserProfile.svelte` (PascalCase)
- **Files**: `user-service.ts` (kebab-case)
- **Functions**: `getUserData()` (camelCase)
- **Constants**: `MAX_RETRY_COUNT` (UPPER_SNAKE_CASE)
- **Types**: `User`, `ApiResponse` (PascalCase)

### TypeScript

```typescript
// ✅ Good - Explicit types
export function getUser(id: string): Promise<User> {
	return db.query('SELECT * FROM users WHERE id = ?', [id]);
}

// ❌ Bad - Using 'any'
export function getUser(id: any): any {
	return db.query(`SELECT * FROM users WHERE id = ${id}`);
}
```

### Database (D1)

```typescript
// ✅ Good - Parameterized queries
await platform.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

// ❌ Bad - SQL injection risk
await platform.env.DB.prepare(`SELECT * FROM users WHERE id = ${userId}`).first();
```

## 🔧 Cloudflare Services

```typescript
// D1 Database
const result = await platform.env.DB.prepare('SELECT * FROM table WHERE id = ?').bind(id).first();

// KV Storage
await platform.env.KV.put('key', 'value');
const value = await platform.env.KV.get('key');

// R2 Storage
await platform.env.BUCKET.put('file.txt', data);
const file = await platform.env.BUCKET.get('file.txt');

// Queues
await platform.env.QUEUE.send({ message: 'data' });
```

## 🎨 Theme System

```svelte
<style>
	/* ✅ Use CSS variables */
	.button {
		background: var(--color-primary);
		color: var(--text-primary);
	}

	/* ❌ Don't hardcode colors */
	.button {
		background: #0066cc;
		color: white;
	}
</style>
```

## 🧪 Test Examples

### Unit Test

```typescript
import { describe, it, expect } from 'vitest';

describe('formatDate', () => {
	it('should format ISO date string', () => {
		expect(formatDate('2024-01-15')).toBe('January 15, 2024');
	});
});
```

### Component Test

```typescript
import { render, screen } from '@testing-library/svelte';
import Button from './Button.svelte';

it('should render button with text', () => {
	render(Button, { props: { label: 'Click me' } });
	expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

### E2E Test

```typescript
import { test, expect } from '@playwright/test';

test('should navigate to page', async ({ page }) => {
	await page.goto('/');
	await page.click('a[href="/about"]');
	await expect(page).toHaveURL('/about');
});
```

## 🚫 What NOT to Do

❌ Start coding before writing tests
❌ Add external packages without justification  
❌ Use `any` type in TypeScript
❌ Hardcode colors or configuration
❌ Use Node.js-specific APIs (Workers runtime)
❌ Skip test coverage checks
❌ Commit without running tests
❌ String concatenation for SQL queries

## 🎯 Package Management

```bash
# Before adding ANY package, ask:
1. Can we build this ourselves?
2. Is it Cloudflare-compatible?
3. Is it actively maintained?
4. Is there a lighter alternative?
5. Is it absolutely necessary?

# Only add if answers are satisfactory
bun add --dev package-name
```

## 🔗 Key Files

- `.github/copilot-instructions.md` - AI coding guidelines
- `CONTRIBUTING.md` - Full contributor guide
- `docs/TDD_WORKFLOW.md` - Detailed TDD examples
- `vite.config.ts` - Test configuration
- `wrangler.toml` - Cloudflare settings

## 📊 Coverage Goals

- **Minimum**: 95% across all metrics — enforced by vitest `thresholds` in `vite.config.ts`
- **Critical paths**: focused tests required; no separate unenforced percentage claim
- **New code**: Must maintain or improve coverage

## 🆘 Getting Help

```bash
# Check if dev works
bun run dev

# Run type checking
bun run check

# View coverage report
bun run test:coverage
# Open: coverage/index.html

# Debug tests
bun run test:ui

# Debug E2E tests
bun run test:e2e:ui
```

## 🌟 Resources

- [SvelteKit Docs](https://kit.svelte.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers)
- [Vitest Docs](https://vitest.dev)
- [Playwright Docs](https://playwright.dev)

---

**Golden Rules**:

1. ✅ Tests first, always
2. ✅ 95% coverage, no exceptions
3. ✅ Build over buy
4. ✅ Cloudflare first
5. ✅ Type safety everywhere

_Happy coding! 🚀_
