/**
 * Static Analysis Security Tests — Secret Exposure Prevention
 *
 * Guards against three categories of accidental secret leakage:
 *
 * 1. `platform.env` referenced in client-side files (.svelte, non-server routes)
 *    — platform is only injected server-side; any reference in client code is a bug.
 *
 * 2. `$env/static/private` or `$env/dynamic/private` imported in client files
 *    — SvelteKit private env modules must only be used in *.server.ts files.
 *
 * 3. A secret env var value directly assigned as an object property anywhere in source
 *    — e.g. `clientSecret: platform.env.GITHUB_CLIENT_SECRET` in a return statement
 *      would serialize the secret into the page data sent to the browser.
 *
 * Known limitation: shorthand return patterns like
 *   const secret = platform.env.MY_SECRET; return { secret };
 * are not caught here. Avoid that pattern — always map to a non-secret-named key
 * or omit from load() return values entirely.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full, extensions));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) results.push(full);
  }
  return results;
}

function rel(f: string) {
  return f.slice(ROOT.length + 1).replace(/\\/g, '/');
}

function read(f: string) {
  const content = readFileSync(f, 'utf-8');
  // Strip <code>...</code> blocks so documentation examples in .svelte files
  // don't trigger false positives (they're rendered HTML, not executed code).
  if (f.endsWith('.svelte')) {
    return content.replace(/<code[^>]*>[\s\S]*?<\/code>/g, '<code></code>');
  }
  return content;
}

function offenders(files: string[], pattern: RegExp): string[] {
  return files.filter((f) => pattern.test(read(f))).map(rel);
}

// ── File lists ────────────────────────────────────────────────────────────────

/** Svelte component and page files — always executed (at least partially) client-side */
const svelteFiles = walk(SRC, ['.svelte']);

/**
 * Non-server route TypeScript files: +page.ts, +layout.ts, etc.
 * These run on both client and server — platform.env must not appear here.
 * Excludes: *.server.ts (server-only load files) and +server.ts (API routes).
 */
const nonServerRouteFiles = walk(join(SRC, 'routes'), ['.ts']).filter(
  (f) => !f.includes('.server.') && basename(f) !== '+server.ts' && !f.includes('.test.')
);

const clientFiles = [...svelteFiles, ...nonServerRouteFiles];

/** Every source file except tests — used for the secret-as-property check */
const allSourceFiles = walk(SRC, ['.ts', '.svelte']).filter((f) => !f.includes('.test.'));

// ── Patterns ──────────────────────────────────────────────────────────────────

/**
 * Detects a secret env var value directly assigned as an object property.
 * Matches:  `clientSecret: platform.env.GITHUB_CLIENT_SECRET`
 *           `token: env.SPOTIFY_REFRESH_TOKEN`
 *           `key: platform.env.SOME_PRIVATE_KEY`
 *
 * Does NOT match (correctly):
 *   `clientId: platform.env.GITHUB_CLIENT_ID`   — _ID is not a secret suffix
 *   `const secret = platform.env.MY_SECRET`      — variable assignment, not a property
 */
const SECRET_AS_PROP =
  /\w+\s*:\s*(?:platform\.env|env)\.\w*(?:_SECRET|_REFRESH_TOKEN|_PRIVATE_KEY)\b/;

/**
 * Detects SvelteKit private env module imports.
 * $env/static/private and $env/dynamic/private are server-only.
 */
const PRIVATE_ENV_IMPORT = /from\s+['"][$]env\/(?:static|dynamic)\/private['"]/;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Secret Exposure Security', () => {
  // Sanity: verify file discovery is actually working
  it('discovers svelte files to scan', () => {
    expect(svelteFiles.length, 'Expected to find .svelte files under src/').toBeGreaterThan(0);
  });

  it('discovers source files to scan', () => {
    expect(allSourceFiles.length, 'Expected to find source files under src/').toBeGreaterThan(0);
  });

  it('platform.env must not appear in client-side files', () => {
    const bad = offenders(clientFiles, /platform\.env\b/);
    expect(
      bad,
      `platform.env found in client-side files (only *.server.ts files may use it):\n  ${bad.join('\n  ')}`
    ).toHaveLength(0);
  });

  it('$env/private modules must not be imported in client-side files', () => {
    const bad = offenders(clientFiles, PRIVATE_ENV_IMPORT);
    expect(
      bad,
      `$env/*/private imported in client-side files (only *.server.ts files may import it):\n  ${bad.join('\n  ')}`
    ).toHaveLength(0);
  });

  it('secret env var values must not be directly returned as object properties', () => {
    const bad = offenders(allSourceFiles, SECRET_AS_PROP);
    expect(
      bad,
      `Files that assign a secret env var value as an object property (risks serialising it into page data):\n  ${bad.join('\n  ')}`
    ).toHaveLength(0);
  });
});
