# Test-Driven Development (TDD) Workflow

This guide demonstrates the TDD workflow for NebulaKit development.

## 🎯 The TDD Cycle

```
┌─────────────┐
│   RED       │  1. Write a failing test
│ (Test Fail) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   GREEN     │  2. Write minimal code to pass
│ (Test Pass) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  REFACTOR   │  3. Improve code quality
│ (Optimize)  │
└──────┬──────┘
       │
       └─────────┐
                 ▼
              REPEAT
```

## 📝 Step-by-Step Example

Let's implement a simple user validation utility using TDD.

### Step 1: RED - Write the Failing Test

**File**: `src/lib/utils/validation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidPassword } from './validation';

describe('Email Validation', () => {
  it('should accept valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.user@domain.co.uk')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('Password Validation', () => {
  it('should accept strong passwords', () => {
    expect(isValidPassword('MyP@ssw0rd123')).toBe(true);
  });

  it('should reject weak passwords', () => {
    expect(isValidPassword('weak')).toBe(false);
    expect(isValidPassword('12345678')).toBe(false);
    expect(isValidPassword('noNumbers!')).toBe(false);
  });

  it('should require minimum 8 characters', () => {
    expect(isValidPassword('Short1!')).toBe(false);
    expect(isValidPassword('LongEnough1!')).toBe(true);
  });
});
```

**Run the test** (it should fail):
```bash
npm run test
```

Expected output: ❌ Module not found errors

### Step 2: GREEN - Write Minimal Code to Pass

**File**: `src/lib/utils/validation.ts`

```typescript
/**
 * Validates email address format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates password strength
 * Requirements: minimum 8 characters, at least one number, one letter, one special char
 */
export function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string') {
    return false;
  }
  
  if (password.length < 8) {
    return false;
  }
  
  const hasNumber = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  return hasNumber && hasLetter && hasSpecial;
}
```

**Run the test** (should pass):
```bash
npm run test
```

Expected output: ✅ All tests passing

### Step 3: REFACTOR - Improve Code Quality

**File**: `src/lib/utils/validation.ts` (refactored)

```typescript
/**
 * Regular expressions for validation
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_PATTERNS = {
  number: /\d/,
  letter: /[a-zA-Z]/,
  special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
};

/**
 * Validates email address format
 * @param email - Email address to validate
 * @returns True if email is valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates password strength
 * Requirements: 
 * - Minimum 8 characters
 * - At least one number
 * - At least one letter
 * - At least one special character
 * 
 * @param password - Password to validate
 * @returns True if password meets requirements, false otherwise
 */
export function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string') {
    return false;
  }
  
  if (password.length < PASSWORD_MIN_LENGTH) {
    return false;
  }
  
  return Object.values(PASSWORD_PATTERNS).every(pattern => pattern.test(password));
}
```

**Run tests again** (should still pass):
```bash
npm run test
```

Expected output: ✅ All tests passing

**Check coverage**:
```bash
npm run test:coverage
```

Expected: 100% coverage on validation.ts

## 🔄 Component Example: TDD for Svelte Component

### Step 1: RED - Write Component Test

**File**: `src/lib/components/EmailInput.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EmailInput from './EmailInput.svelte';

describe('EmailInput', () => {
  it('should render email input field', () => {
    render(EmailInput);
    const input = screen.getByRole('textbox', { name: /email/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'email');
  });

  it('should show error for invalid email', async () => {
    render(EmailInput);
    const input = screen.getByRole('textbox', { name: /email/i });
    
    await fireEvent.input(input, { target: { value: 'invalid' } });
    await fireEvent.blur(input);
    
    const error = screen.getByText(/invalid email/i);
    expect(error).toBeInTheDocument();
  });

  it('should not show error for valid email', async () => {
    render(EmailInput);
    const input = screen.getByRole('textbox', { name: /email/i });
    
    await fireEvent.input(input, { target: { value: 'user@example.com' } });
    await fireEvent.blur(input);
    
    expect(screen.queryByText(/invalid email/i)).not.toBeInTheDocument();
  });

  it('should call onChange callback with value', async () => {
    let receivedValue = '';
    render(EmailInput, {
      props: {
        onChange: (value: string) => { receivedValue = value; }
      }
    });
    
    const input = screen.getByRole('textbox', { name: /email/i });
    await fireEvent.input(input, { target: { value: 'test@test.com' } });
    
    expect(receivedValue).toBe('test@test.com');
  });
});
```

Run test: `npm run test` → ❌ Should fail

### Step 2: GREEN - Implement Component

**File**: `src/lib/components/EmailInput.svelte`

```svelte
<script lang="ts">
  import { isValidEmail } from '$lib/utils/validation';
  
  export let value = '';
  export let onChange: (value: string) => void = () => {};
  
  let touched = false;
  let error = '';
  
  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    onChange(value);
    
    if (touched) {
      validate();
    }
  }
  
  function handleBlur() {
    touched = true;
    validate();
  }
  
  function validate() {
    if (value && !isValidEmail(value)) {
      error = 'Invalid email address';
    } else {
      error = '';
    }
  }
</script>

<div class="email-input">
  <label for="email">
    Email Address
  </label>
  <input
    id="email"
    type="email"
    bind:value
    on:input={handleInput}
    on:blur={handleBlur}
    aria-invalid={!!error}
    aria-describedby={error ? 'email-error' : undefined}
  />
  {#if error}
    <span id="email-error" class="error" role="alert">
      {error}
    </span>
  {/if}
</div>

<style>
  .email-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  label {
    font-weight: 500;
  }
  
  input {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
  }
  
  input[aria-invalid="true"] {
    border-color: var(--error-color);
  }
  
  .error {
    color: var(--error-color);
    font-size: 0.875rem;
  }
</style>
```

Run test: `npm run test` → ✅ Should pass

### Step 3: REFACTOR

Add TypeScript types, improve accessibility, extract styles to CSS variables.

## 🎯 Integration Test Example

### Testing API Endpoints

**File**: `src/routes/api/users/+server.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from './+server';
import { createMockPlatform } from '../../../../tests/fixtures';

describe('Users API', () => {
  let mockPlatform: ReturnType<typeof createMockPlatform>;
  
  beforeEach(() => {
    mockPlatform = createMockPlatform();
  });

  describe('GET /api/users', () => {
    it('should return list of users', async () => {
      const request = new Request('http://localhost/api/users');
      const response = await GET({ 
        request, 
        platform: mockPlatform,
        locals: { user: { id: '1' } }
      } as any);
      
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
    });

    it('should require authentication', async () => {
      const request = new Request('http://localhost/api/users');
      
      await expect(async () => {
        await GET({ 
          request, 
          platform: mockPlatform,
          locals: {}
        } as any);
      }).rejects.toThrow();
    });
  });

  describe('POST /api/users', () => {
    it('should create new user', async () => {
      const userData = { 
        email: 'new@example.com',
        name: 'New User'
      };
      
      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await POST({ 
        request, 
        platform: mockPlatform,
        locals: { user: { id: '1' } }
      } as any);
      
      expect(response.status).toBe(201);
    });

    it('should validate user data', async () => {
      const invalidData = { email: 'invalid' };
      
      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      });
      
      await expect(async () => {
        await POST({ 
          request, 
          platform: mockPlatform,
          locals: { user: { id: '1' } }
        } as any);
      }).rejects.toThrow(/validation/i);
    });
  });
});
```

## 🎬 E2E Test Example

**File**: `tests/e2e/user-registration.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test('should complete full registration', async ({ page }) => {
    // Navigate to signup
    await page.goto('/auth/signup');
    
    // Fill form
    await page.fill('input[type="email"]', 'newuser@example.com');
    await page.fill('input[name="password"]', 'SecureP@ss123');
    await page.fill('input[name="confirmPassword"]', 'SecureP@ss123');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('should show validation errors', async ({ page }) => {
    await page.goto('/auth/signup');
    
    await page.fill('input[type="email"]', 'invalid');
    await page.fill('input[name="password"]', 'weak');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=/invalid email/i')).toBeVisible();
    await expect(page.locator('text=/password.*weak/i')).toBeVisible();
  });
});
```

## 🏃 Running Tests

```bash
# Watch mode during development
npm run test:watch

# Run all tests before commit
npm run test

# Check coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 📊 Coverage Reports

After running `npm run test:coverage`, open `coverage/index.html` in your browser to see detailed coverage reports.

## ✅ Best Practices

1. **Always write tests first** - No exceptions
2. **Test behavior, not implementation** - Tests should survive refactoring
3. **Keep tests simple** - One assertion per test when possible
4. **Use descriptive test names** - "should do X when Y happens"
5. **Arrange-Act-Assert** - Structure tests clearly
6. **Mock external dependencies** - Tests should be fast and isolated
7. **Test edge cases** - Empty strings, null, undefined, large numbers
8. **Maintain 90%+ coverage** - Use coverage reports to find gaps

## 🚫 Common Mistakes

❌ Writing code before tests
❌ Testing implementation details
❌ Skipping edge cases
❌ Ignoring failing tests
❌ Not running tests before commit
❌ Large, complex tests
❌ No assertions in tests

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
- [Playwright Documentation](https://playwright.dev/)

---

**Remember**: Tests are not just verification—they're documentation, design tools, and safety nets. Write them first! 🧪
