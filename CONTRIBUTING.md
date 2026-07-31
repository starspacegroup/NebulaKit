# Contributing to NebulaKit

Thank you for your interest in contributing to NebulaKit! This guide will help you understand our development process and standards.

## 🎯 Development Philosophy

**Test-Driven Development (TDD) is mandatory.** We don't accept contributions without tests.

### The TDD Cycle

1. **Write a failing test** - Define the behavior you want
2. **Make it pass** - Write minimal code to pass the test
3. **Refactor** - Improve code quality while keeping tests green
4. **Repeat** - Continue for each piece of functionality

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/starspacegroup/NebulaKit.git
cd NebulaKit

# Install dependencies
npm install

# Run development server (must work!)
npm run dev
```

Visit `http://localhost:4277` to verify everything works.

## 🧪 Testing Requirements

### Coverage Requirements

- **Minimum 90% code coverage** across all modules
- **100% coverage** on critical paths (auth, payments, data mutations)
- All tests must pass before submitting a PR

### Running Tests

```bash
# Run unit and integration tests
npm run test

# Run tests in watch mode
npm run test:watch

# Check coverage (must be ≥90%)
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run all tests
npm run test:all
```

### Test Structure

```
tests/
├── unit/               # Pure functions, utilities, stores
├── integration/        # API endpoints, database operations
├── e2e/               # Complete user workflows
├── fixtures/          # Mock data and test utilities
└── setup.ts          # Global test setup
```

### Writing Tests

#### Unit Tests

```typescript
// src/lib/utils/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
	it('should format ISO date to readable string', () => {
		const result = formatDate('2024-01-15');
		expect(result).toBe('January 15, 2024');
	});

	it('should handle invalid dates gracefully', () => {
		const result = formatDate('invalid');
		expect(result).toBe('Invalid Date');
	});
});
```

#### Component Tests

```typescript
// src/lib/components/Button.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Button from './Button.svelte';

describe('Button', () => {
	it('should render with text', () => {
		render(Button, { props: { label: 'Click me' } });
		expect(screen.getByText('Click me')).toBeInTheDocument();
	});

	it('should call onClick when clicked', async () => {
		let clicked = false;
		render(Button, {
			props: {
				label: 'Click me',
				onClick: () => {
					clicked = true;
				}
			}
		});

		await fireEvent.click(screen.getByText('Click me'));
		expect(clicked).toBe(true);
	});
});
```

#### E2E Tests

```typescript
// tests/e2e/feature.test.ts
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
	test('should complete user workflow', async ({ page }) => {
		await page.goto('/');
		await page.click('button[aria-label="Start"]');
		await expect(page.locator('h1')).toContainText('Success');
	});
});
```

## 📖 Documentation Requirements

**The `/documentation` route ships with the feature, not after it.**

`src/routes/documentation/+page.svelte` is the in-app documentation users read. Any change that adds,
removes, or alters a user-visible feature — a route, setup step, command, integration, binding, env
var, shortcut, or admin capability — must update that page in the **same** PR, with matching
assertions in `tests/unit/documentation-page.test.ts`.

Internal-only changes (refactors, test-only work, dependency bumps) need no doc update — say so in
the PR description so the omission is visible as a decision.

Details, section map, and the scaffold for recreating the route: [docs/DOCUMENTATION_PAGE.md](docs/DOCUMENTATION_PAGE.md).

## 📝 Code Style

### TypeScript

- Use explicit types (avoid `any`)
- Prefer interfaces over types for objects
- Document public APIs with JSDoc

### Naming Conventions

- **Components**: PascalCase (`UserProfile.svelte`)
- **Files**: kebab-case (`user-service.ts`)
- **Variables/Functions**: camelCase (`getUserData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)

### File Structure

```
src/lib/components/
├── Button.svelte
├── Button.test.ts        # Test file next to component
└── types.ts             # Component-specific types
```

## 🏗️ Architecture Guidelines

### Cloudflare-First

- Use Cloudflare services (D1, KV, R2, Queues, Turnstile)
- Optimize for edge runtime
- Consider cold start performance
- No Node.js-specific APIs

### Minimal Dependencies

- **Build, don't buy** - Implement in-house when feasible
- Avoid external packages for: WYSIWYG editors, user management, SSO, UI components
- Only add dependencies for: complex functionality (crypto), Cloudflare integrations, core framework needs

### Database Operations

```typescript
// ✅ Good - Parameterized queries
await platform.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

// ❌ Bad - String concatenation (SQL injection risk)
await platform.env.DB.prepare(`SELECT * FROM users WHERE id = ${userId}`).first();
```

## 🔄 Git Workflow

### Branch Naming

- `feature/short-description` - New features
- `fix/bug-description` - Bug fixes
- `test/what-testing` - Test improvements
- `refactor/what-refactoring` - Code refactoring
- `docs/what-documenting` - Documentation

### Commit Messages

```
type(scope): short description

Longer explanation if needed

- Bullet points for details
- Reference issues: Fixes #123
```

**Types**: `feat`, `fix`, `test`, `refactor`, `docs`, `style`, `chore`

**Examples**:

```
feat(auth): add email verification flow
fix(chat): resolve message ordering issue
test(stores): add theme store coverage
refactor(db): optimize user query performance
docs(readme): update setup instructions
```

### Before Committing

```bash
# 1. Run all tests
npm run test

# 2. Check coverage
npm run test:coverage

# 3. Type checking
npm run check

# 4. Verify dev environment
npm run dev
```

## 📋 Pull Request Process

### PR Checklist

- [ ] Tests written **before** implementation (TDD)
- [ ] All tests passing (`npm run test:all`)
- [ ] Coverage ≥ 90% (`npm run test:coverage`)
- [ ] TypeScript checks pass (`npm run check`)
- [ ] Dev environment works (`npm run dev`)
- [ ] No new external dependencies (or justified in PR description)
- [ ] Code follows style guidelines
- [ ] `/documentation` route updated for any user-visible change (or "internal only" noted below)
- [ ] `tests/unit/documentation-page.test.ts` asserts the new/changed documentation
- [ ] Supporting docs (`README.md`, `docs/`) updated
- [ ] Commit messages follow convention

### PR Title

Follow the same format as commit messages:

```
feat(scope): add new feature
fix(scope): resolve bug
```

### PR Description Template

```markdown
## Description

Brief description of changes

## Motivation

Why is this change needed?

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] All tests passing
- [ ] Coverage ≥ 90%

## Screenshots (if applicable)

## Additional Notes
```

## 🚨 Common Mistakes to Avoid

1. ❌ **Skipping tests** - Tests are NOT optional
2. ❌ **Adding dependencies without justification** - Build first, import last
3. ❌ **Ignoring TypeScript errors** - Fix them, don't suppress
4. ❌ **Not testing locally** - Always verify dev environment works
5. ❌ **Hardcoding values** - Use environment variables
6. ❌ **Using Node.js APIs** - Use Web APIs for Cloudflare Workers
7. ❌ **Committing without coverage check** - Must maintain 90%+
8. ❌ **Shipping a feature without updating `/documentation`** - In-app docs are part of the feature

## 🎨 UI/UX Standards

### Accessibility

- Include proper ARIA labels
- Ensure keyboard navigation
- Test with screen readers
- Maintain heading hierarchy
- Meet WCAG AA contrast ratios

### Responsive Design

- Mobile-first approach
- Test on mobile, tablet, desktop
- Use relative units (rem, em, %)
- Touch targets ≥ 44x44px

### Theme System

- Use CSS custom properties from `app.css`
- Support light/dark modes
- Never hardcode colors

## 🔒 Security

- Validate all user input
- Use parameterized queries (never string concatenation)
- Implement CSRF protection
- Use Cloudflare Turnstile for forms
- Sanitize output (prevent XSS)
- Store secrets in Cloudflare Workers secrets

## 📚 Resources

- [GitHub Copilot Instructions](.github/copilot-instructions.md)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)

## 💬 Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Be respectful and constructive

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

**Remember**: Quality over speed. Write tests first. Build instead of importing. Optimize for Cloudflare. 🚀
