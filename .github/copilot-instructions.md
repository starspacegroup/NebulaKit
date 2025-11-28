# GitHub Copilot Instructions for NebulaKit

## 🖥️ Development Environment Assumptions

**Dev Server is Always Running (Local Copilot Chat Only)**

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

## 🎯 Core Development Philosophy

**Test-Driven Development (TDD) is MANDATORY**

- Never start a feature or bug fix without writing tests first
- Write failing tests, then implement code to make them pass
- Maintain 90%+ code coverage across all modules
- Tests are not optional—they are part of the definition of "done"

## 🏗️ Architecture Principles

### Cloudflare-First Development

- **Always optimize for Cloudflare Workers runtime**
- Use Cloudflare services as the default choice:
  - D1 for database operations
  - KV for key-value storage
  - R2 for object storage
  - Queues for background jobs
  - Turnstile for CAPTCHA
  - Workers AI for AI/ML operations
- Avoid external services that duplicate Cloudflare functionality
- Consider edge computing patterns and cold start optimization

### Minimal External Dependencies

- **Build, don't buy** - Implement features in-house whenever feasible
- Avoid external packages for:
  - WYSIWYG editors (build custom)
  - User management (use built-in auth)
  - SSO integrations (implement directly with Auth.js/SvelteKit)
  - UI components (extend internal component library)
  - Form validation (custom implementations)
  - State management (use Svelte stores)
- Only add external packages when:
  - The functionality is extremely complex (e.g., cryptography)
  - It's a Cloudflare-native integration
  - It's a core framework requirement (SvelteKit, Vite)
  - The package is well-maintained, lightweight, and has no alternatives

## 🧪 Testing Standards

### Test Structure

```typescript
// tests/unit/feature.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Feature Name', () => {
	beforeEach(() => {
		// Setup test environment
	});

	afterEach(() => {
		// Cleanup
	});

	it('should do X when Y happens', () => {
		// Arrange
		// Act
		// Assert
	});
});
```

### Coverage Requirements

- **Minimum 90% coverage** on all modules
- 100% coverage on critical paths (auth, payments, data mutations)
- Every new feature must include:
  - Unit tests for business logic
  - Integration tests for API endpoints
  - Component tests for UI elements
  - E2E tests for critical user flows

### Test Types

1. **Unit Tests** (`tests/unit/`)
   - Pure functions and utilities
   - Individual Svelte components
   - Store logic
   - Database queries (mocked)

2. **Integration Tests** (`tests/integration/`)
   - API endpoints with SvelteKit
   - Database operations with test D1 instance
   - Service layer interactions

3. **E2E Tests** (`tests/e2e/`)
   - Complete user workflows
   - Authentication flows
   - Critical business processes

## 🚀 Development Workflow

### 1. Starting Any Work

```bash
# Always ensure dev environment works
npm run dev

# Create feature branch
git checkout -b feature/feature-name

# Write tests FIRST
# Create test file before implementation file
```

### 2. TDD Cycle (Red-Green-Refactor)

1. **RED**: Write a failing test that defines desired behavior
2. **GREEN**: Write minimal code to make the test pass
3. **REFACTOR**: Improve code quality while keeping tests green
4. **REPEAT**: Continue for each small piece of functionality

### 3. Before Committing

```bash
# Run all tests
npm run test

# Check coverage
npm run test:coverage

# Type checking
npm run check

# Ensure dev still works
npm run dev
```

## 📁 Project Structure

```
NebulaKit/
├── src/
│   ├── lib/
│   │   ├── components/      # Svelte components (with .test.ts files)
│   │   ├── stores/          # Svelte stores (with .test.ts files)
│   │   ├── utils/           # Utility functions (with .test.ts files)
│   │   ├── services/        # Business logic (with .test.ts files)
│   │   └── types/           # TypeScript types
│   ├── routes/              # SvelteKit routes (with .test.ts files)
│   └── app.html
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   ├── e2e/                 # End-to-end tests
│   └── fixtures/            # Test data and mocks
├── migrations/              # D1 database migrations
└── wrangler.toml           # Cloudflare configuration
```

## 💡 Code Patterns

### Component Development

```svelte
<script lang="ts">
	// Use TypeScript always
	import type { ComponentProps } from './types';

	// Props with types
	export let data: ComponentProps;

	// Reactive statements for derived state
	$: derivedValue = computeValue(data);
</script>

<!-- Template with proper accessibility -->
<div role="region" aria-label="descriptive-label">
	{#if condition}
		<p>{derivedValue}</p>
	{/if}
</div>

<style>
	/* Component-scoped styles */
	div {
		/* Use CSS custom properties for theming */
		color: var(--text-primary);
	}
</style>
```

### Database Operations (D1)

```typescript
// Always use parameterized queries
export async function getUser(platform: Platform, userId: string) {
	return await platform.env.DB.prepare('SELECT * FROM users WHERE id = ?')
		.bind(userId)
		.first<User>();
}

// Use transactions for related operations
export async function createUserWithProfile(platform: Platform, userData: UserData) {
	return await platform.env.DB.batch([
		platform.env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind(userData.name),
		platform.env.DB.prepare('INSERT INTO profiles (user_id) VALUES (?)').bind(userData.id)
	]);
}
```

### API Endpoints

```typescript
// src/routes/api/resource/+server.ts
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ platform, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Use Cloudflare bindings via platform
		const data = await platform.env.DB.prepare('SELECT * FROM table').all();
		return json(data);
	} catch (err) {
		throw error(500, 'Internal server error');
	}
};
```

## 🎨 UI/UX Standards

### Accessibility

- Always include proper ARIA labels
- Ensure keyboard navigation works
- Test with screen readers
- Maintain proper heading hierarchy
- Color contrast ratios must meet WCAG AA

### Responsive Design

- Mobile-first approach
- Test on mobile, tablet, and desktop
- Use relative units (rem, em, %)
- Implement proper touch targets (44x44px minimum)

### Theme System

**CRITICAL: All colors MUST use CSS custom properties (CSS variables)**

#### Color Usage Rules

- **NEVER hardcode color values** - Always reference theme variables from `app.css`
- **NEVER use** `#hex`, `rgb()`, `hsl()`, or named colors directly in components
- **ALWAYS use** `var(--color-*)` for any color value
- This applies to ALL styling:
  - Background colors
  - Text colors
  - Border colors
  - Shadow colors (use CSS variables with alpha)
  - SVG fill/stroke colors
  - Pseudo-element colors (::before, ::after)
  - Hover/focus/active states

#### Comprehensive Theme Coverage

Create CSS variable overrides for ALL browser elements to ensure consistent theming:

**Forms & Inputs:**

```css
input,
textarea,
select {
	background-color: var(--color-surface);
	color: var(--color-text);
	border-color: var(--color-border);
}

input:focus,
textarea:focus,
select:focus {
	border-color: var(--color-primary);
	outline-color: var(--color-primary);
}

input::placeholder {
	color: var(--color-text-secondary);
}

/* Autofill states */
input:-webkit-autofill {
	-webkit-text-fill-color: var(--color-text);
	-webkit-box-shadow: 0 0 0 1000px var(--color-surface) inset;
}
```

**Scrollbars:**

```css
::-webkit-scrollbar {
	background: var(--color-surface);
}

::-webkit-scrollbar-thumb {
	background: var(--color-border);
}

::-webkit-scrollbar-thumb:hover {
	background: var(--color-text-secondary);
}
```

**Selection:**

```css
::selection {
	background-color: var(--color-primary);
	color: var(--color-background);
}
```

**Other Elements:**

- Checkboxes, radio buttons, range sliders
- Progress bars, meters
- Dialog backdrops
- Table borders and stripes
- Code blocks and syntax highlighting
- Toast notifications, modals

#### Minimalist Design Principles

- **Clean, uncluttered interfaces** - Remove unnecessary decorations
- **Generous whitespace** - Use `var(--spacing-*)` consistently
- **Subtle borders** - Prefer `1px` borders with `var(--color-border)`
- **Minimal shadows** - Use `var(--shadow-sm)` or `var(--shadow-md)` sparingly
- **Simple animations** - Use `var(--transition-*)` for smooth, not flashy
- **Typography hierarchy** - Let font size and weight create visual structure
- **Icon-first design** - Use clear, simple icons over text when appropriate
- **Consistent spacing** - Maintain rhythm with spacing scale

#### Contrast Validation

- **All text/background combinations MUST meet WCAG AA standards**
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text
- Automated contrast checking runs on build/test
- Use the `checkContrast()` utility when creating new color variables
- If contrast fails, adjust colors or provide alternative combinations

#### Example Component Styling

```svelte
<style>
	.button {
		/* ✅ CORRECT */
		background-color: var(--color-primary);
		color: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-sm) var(--spacing-md);
		transition: background-color var(--transition-fast);
	}

	.button:hover {
		background-color: var(--color-primary-hover);
	}

	/* ❌ WRONG */
	.bad-button {
		background-color: #0066cc; /* Never hardcode colors! */
		color: white; /* Never use color keywords! */
		border: 1px solid #ddd; /* Never use hex codes! */
	}
</style>
```

#### When Suggesting Styles

1. Check if appropriate CSS variables exist in `app.css`
2. If missing, suggest adding to `app.css` first
3. Ensure both light and dark theme values are defined
4. Run contrast validation for new color combinations
5. Always use variables in component styles

## 🔒 Security Practices

- Validate all user input
- Use parameterized queries (never string concatenation)
- Implement CSRF protection
- Use Cloudflare Turnstile for forms
- Sanitize output to prevent XSS
- Follow principle of least privilege
- Store secrets in Cloudflare Workers secrets (never in code)

## 📝 Code Style

### TypeScript

- Use explicit types (avoid `any`)
- Prefer interfaces over types for objects
- Use readonly where appropriate
- Document public APIs with JSDoc

### Naming Conventions

- Components: PascalCase (`UserProfile.svelte`)
- Files: kebab-case (`user-service.ts`)
- Variables/functions: camelCase (`getUserData`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- Types/Interfaces: PascalCase (`User`, `ApiResponse`)

### Comments

- Write self-documenting code first
- Comment "why", not "what"
- Use JSDoc for public APIs
- Keep comments up-to-date

## 🚨 Common Pitfalls to Avoid

1. **Don't skip tests** - Tests are not optional
2. **Don't add dependencies without justification** - Build first
3. **Don't forget Cloudflare Workers limitations**:
   - No filesystem access
   - 128MB memory limit
   - 50ms CPU time for free tier
   - Consider cold starts
4. **Don't use Node.js-specific APIs** - Use Web APIs instead
5. **Don't ignore TypeScript errors** - Fix them, don't suppress them
6. **Don't commit without testing locally first**
7. **Don't hardcode configuration** - Use environment variables

## 🔄 Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `test/description` - Test improvements
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

### Commit Messages

```
type(scope): short description

Longer explanation if needed

- Bullet points for details
- Reference issues: Fixes #123
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `style`, `chore`

### Pull Request Checklist

- [ ] Tests written first (TDD)
- [ ] All tests passing
- [ ] Coverage ≥ 90%
- [ ] TypeScript checks pass
- [ ] Local dev environment works
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] No new external dependencies (or justified)

## 🎯 When Suggesting Code

**GitHub Copilot, when generating code:**

1. Always consider test implications first
2. Suggest the test before the implementation
3. Use Cloudflare Workers APIs and patterns
4. Avoid suggesting external npm packages
5. Follow the TDD cycle
6. Include proper TypeScript types
7. Consider edge runtime limitations
8. Optimize for cold start performance
9. Use SvelteKit and Svelte best practices
10. Ensure accessibility standards

## 📚 Key Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)

---

**Remember**: Quality over speed. Write tests first. Build instead of importing. Optimize for Cloudflare.
