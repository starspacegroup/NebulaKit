# Theme System Documentation

## 🎨 Overview

NebulaKit uses a comprehensive CSS custom properties (CSS variables) system for theming. **All colors, spacing, typography, and design tokens MUST use CSS variables** - never hardcode values.

## 🚨 Critical Rules

### 1. NEVER Hardcode Colors

**❌ WRONG:**

```svelte
<style>
	.button {
		background-color: #0066cc;
		color: white;
		border: 1px solid #ddd;
	}
</style>
```

**✅ CORRECT:**

```svelte
<style>
	.button {
		background-color: var(--color-primary);
		color: var(--color-background);
		border: 1px solid var(--color-border);
	}
</style>
```

### 2. Use Variables for ALL Color References

This includes:

- Background colors
- Text colors
- Border colors
- Shadow colors
- SVG fill/stroke
- Pseudo-elements (::before, ::after)
- Hover/focus/active states
- Placeholder text
- Selection highlights

### 3. Maintain WCAG AA Contrast Standards

All text/background combinations must meet:

- **4.5:1** minimum for normal text
- **3:1** minimum for large text (18pt+)
- Run `npm run validate:contrast` to check

## 📋 Available CSS Variables

### Colors

#### Light Theme (default)

```css
/* Primary colors */
--color-primary: #0066cc; /* Main brand color */
--color-primary-hover: #0052a3; /* Hover state */
--color-secondary: #6366f1; /* Secondary accent */
--color-secondary-hover: #4f46e5; /* Secondary hover */

/* Backgrounds */
--color-background: #ffffff; /* Page background */
--color-surface: #f8f9fa; /* Cards, panels */
--color-surface-hover: #e9ecef; /* Surface hover state */

/* Text */
--color-text: #1a1a1a; /* Primary text */
--color-text-secondary: #5a6169; /* Secondary text (WCAG AA: 5.95:1) */

/* Borders */
--color-border: #dee2e6; /* Borders, dividers */

/* Semantic colors */
--color-error: #dc3545; /* Error states */
--color-success: #28a745; /* Success states */
--color-warning: #ffc107; /* Warning states */
```

#### Dark Theme

Apply `data-theme="dark"` to `<html>` or any container:

```css
--color-primary: #3b82f6;
--color-background: #0a0a0a;
--color-surface: #1a1a1a;
--color-text: #f8f9fa;
--color-text-secondary: #adb5bd;
--color-border: #3a3a3a;
/* ... and more */
```

### Spacing

```css
--spacing-xs: 0.25rem; /* 4px */
--spacing-sm: 0.5rem; /* 8px */
--spacing-md: 1rem; /* 16px */
--spacing-lg: 1.5rem; /* 24px */
--spacing-xl: 2rem; /* 32px */
--spacing-2xl: 3rem; /* 48px */
```

### Border Radius

```css
--radius-sm: 0.25rem; /* 4px */
--radius-md: 0.5rem; /* 8px */
--radius-lg: 0.75rem; /* 12px */
--radius-xl: 1rem; /* 16px */
```

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
```

### Typography

```css
--font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace;
```

### Transitions

```css
--transition-fast: 150ms ease;
--transition-base: 250ms ease;
--transition-slow: 350ms ease;
```

## 🎯 Common Patterns

### Buttons

```svelte
<style>
	.button {
		background-color: var(--color-primary);
		color: var(--color-background);
		border: none;
		border-radius: var(--radius-md);
		padding: var(--spacing-sm) var(--spacing-md);
		transition: background-color var(--transition-fast);
	}

	.button:hover {
		background-color: var(--color-primary-hover);
	}

	.button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
```

### Cards

```svelte
<style>
	.card {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		box-shadow: var(--shadow-sm);
		color: var(--color-text);
	}

	.card:hover {
		background-color: var(--color-surface-hover);
	}
</style>
```

### Form Inputs

```svelte
<style>
	input {
		background-color: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-sm) var(--spacing-md);
		transition: border-color var(--transition-fast);
	}

	input:focus {
		border-color: var(--color-primary);
		outline: none;
	}

	input::placeholder {
		color: var(--color-text-secondary);
	}
</style>
```

## 🧪 Testing Contrast

### Manual Testing

1. **Run validation script:**

   ```bash
   npm run validate:contrast
   ```

2. **Online tools:**
   - https://contrast-ratio.com
   - https://webaim.org/resources/contrastchecker/

### Automated Testing

All theme colors are validated in `tests/unit/theme-contrast.test.ts`:

```typescript
import { validateThemeContrast } from '$lib/utils/contrast';

const result = validateThemeContrast(theme, 'my-theme');
expect(result.isValid).toBe(true);
```

## 🎨 Minimalist Design Principles

### Visual Hierarchy Through Simplicity

1. **Clean interfaces** - Remove unnecessary decorations
2. **Generous whitespace** - Use `var(--spacing-*)` consistently
3. **Subtle borders** - Prefer `1px` with `var(--color-border)`
4. **Minimal shadows** - Use `var(--shadow-sm)` or `var(--shadow-md)` sparingly
5. **Simple animations** - Use transitions for smoothness, not flash
6. **Typography first** - Let size and weight create structure
7. **Icon-first** - Clear icons over text when appropriate
8. **Consistent spacing** - Maintain rhythm using spacing scale

### Example: Minimalist Card

```svelte
<style>
	.card {
		/* Simple background and border */
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);

		/* Generous padding */
		padding: var(--spacing-lg);

		/* Subtle shadow */
		box-shadow: var(--shadow-sm);

		/* Smooth transitions */
		transition: box-shadow var(--transition-base);
	}

	.card:hover {
		/* Subtle elevation on hover */
		box-shadow: var(--shadow-md);
	}

	.card-title {
		/* Typography creates hierarchy */
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
	}

	.card-content {
		/* Generous line height for readability */
		line-height: 1.6;
		color: var(--color-text);
	}
</style>
```

## 🔧 Adding New Theme Colors

1. **Add to `src/app.css`:**

```css
:root {
	--color-my-new-color: #123456;
}

[data-theme='dark'] {
	--color-my-new-color: #654321;
}
```

2. **Validate contrast:**

Update `scripts/validate-theme-contrast.cjs` if it's a text color:

```javascript
const themes = {
	light: {
		// ... existing colors
		myNewColor: '#123456'
	}
};
```

Run: `npm run validate:contrast`

3. **Update TypeScript types:**

Add to `src/lib/utils/contrast.ts` if needed:

```typescript
export interface ThemeColors {
	// ... existing
	myNewColor?: string;
}
```

## ✅ Checklist for Theme-Aware Components

- [ ] All colors use CSS variables (no hardcoded hex/rgb/hsl)
- [ ] Component tested in both light and dark themes
- [ ] Hover/focus states use theme variables
- [ ] Text meets WCAG AA contrast (4.5:1)
- [ ] Borders use `var(--color-border)`
- [ ] Shadows use theme shadow variables
- [ ] Spacing uses theme spacing variables
- [ ] Transitions use theme transition variables

## 🚀 Quick Reference

**Need a color?** → Check `src/app.css` first  
**Color doesn't exist?** → Add to `app.css` for both themes  
**Check contrast?** → `npm run validate:contrast`  
**Test component?** → Toggle theme in app (Ctrl+K → "toggle theme")  
**Documentation?** → You're reading it! 📚

---

**Remember:** Theme consistency is not optional. Using CSS variables everywhere ensures:

- ✅ Dark mode works automatically
- ✅ Consistent brand colors
- ✅ Easy theme updates
- ✅ Accessible contrast ratios
- ✅ Professional, cohesive UI
