# Zero Environment Variable Setup Guide (Optional)

> **💡 Recommended:** For production deployments, we recommend using **secure environment variables** in Cloudflare Pages. See the [Deployment documentation](../src/routes/documentation/+page.svelte) for details.
>
> The zero-config setup described below is an **alternative approach** for scenarios where you want to configure credentials via a web UI instead.

---

## Getting Started

[![Use this template](https://img.shields.io/badge/Use%20this%20template-238636?style=for-the-badge&logo=github&logoColor=white)](https://github.com/new?template_name=NebulaKit&template_owner=starspacegroup)

Click the button above to create your own repository from the NebulaKit template, then follow the setup instructions below.

---

NebulaKit can work **without any pre-configured environment variables**. Instead of relying on `.env` files or manually set secrets, all configuration is done through a web-based setup flow and stored in Cloudflare KV. Secret values are encrypted before they are written; see [Secrets at rest](#secrets-at-rest) for exactly what that does and does not protect.

Before running this setup flow in a template-derived project, complete [INITIAL_CUSTOMIZATION.md](./INITIAL_CUSTOMIZATION.md) so the app name, sharing assets, and documentation links are updated first.

## When to Use Zero-Config

| Use Case                      | Recommended Approach     |
| ----------------------------- | ------------------------ |
| Production deployments        | ✅ Environment variables |
| Non-technical users deploying | Zero-config via `/setup` |
| Quick prototyping/demos       | Zero-config via `/setup` |
| Runtime credential changes    | Zero-config via `/setup` |
| Learning/educational          | Zero-config via `/setup` |

## Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Fresh Deploy  │───▶│   /setup Page   │───▶│  Admin Login    │
│   (No Config)   │    │  Enter Creds    │    │  Locks Setup    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌─────────────────┐             │
                       │  Normal Usage   │◀────────────┘
                       │  (Locked Down)  │
                       └─────────────────┘
                                │
                                ▼ (if needed)
                       ┌─────────────────┐    ┌─────────────────┐
                       │   /reset Page   │───▶│   /setup Page   │
                       │  Clear Config   │    │  Re-configure   │
                       └─────────────────┘    └─────────────────┘
```

## Why No Environment Variables?

Traditional approaches require setting up secrets before deployment:

```bash
# ❌ Traditional approach - secrets in env files
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=yyy
ADMIN_GITHUB_ID=zzz
```

**Problems with this approach:**

- Secrets in version control (`.env.example` patterns)
- Manual secret rotation requires redeployment
- Different secrets for each environment
- Onboarding friction for new developers

**NebulaKit's approach:**

- ✅ Zero secrets in code or environment
- ✅ Web-based configuration at runtime
- ✅ Secrets encrypted (AES-256-GCM) before they reach Cloudflare KV; see [Secrets at rest](#secrets-at-rest) for the trust model
- ✅ Self-service setup for new deployments
- ✅ Easy secret rotation without redeployment

---

## The `/setup` Page

### When Is It Accessible?

The setup page (`/setup`) is only accessible when:

1. **No admin has logged in yet** - The `admin_first_login_completed` flag is not set in KV

Once the designated admin user logs in for the first time, the setup page is permanently locked.

### What Gets Configured?

| Configuration              | Storage Key             | Description                                     |
| -------------------------- | ----------------------- | ----------------------------------------------- |
| GitHub OAuth Client ID     | `auth_config:github`    | Your GitHub OAuth App's client ID               |
| GitHub OAuth Client Secret | `auth_config:github`    | Your GitHub OAuth App's client secret           |
| Admin GitHub Username      | `github_owner_username` | The GitHub user who becomes the app owner/admin |

### Setup Flow

#### Step 1: Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the form:
   - **Application name:** NebulaKit (or your choice)
   - **Homepage URL:** `https://your-app.pages.dev` (or `http://localhost:4277` for local dev)
   - **Authorization callback URL:** `https://your-app.pages.dev/api/auth/github/callback`
4. Click **"Register application"**
5. Copy the **Client ID**
6. Click **"Generate a new client secret"** and copy it immediately

#### Step 2: Complete the Setup Form

Navigate to `/setup` and enter:

- **GitHub Client ID** - From your OAuth app
- **GitHub Client Secret** - Generated in the previous step
- **Admin GitHub Username** - Your GitHub username (e.g., `octocat`)

#### Step 3: Log In as Admin

After saving the configuration:

1. Click **"Sign In with GitHub"**
2. Authorize the OAuth app
3. You'll be redirected and logged in as the admin owner

> ⚠️ **Important:** This first login permanently locks the setup page. Make sure you're logged in with the correct GitHub account!

### What Happens Behind the Scenes

```typescript
// When you submit the setup form:
// 1. OAuth credentials are stored in KV. The client secret is sealed first
//    (src/lib/server/secret-store.ts); the client ID is not secret.
await platform.env.KV.put(
	'auth_config:github',
	JSON.stringify({
		clientId: 'your_client_id',
		clientSecret: 'v1.<iv>.<ciphertext>', // AES-GCM envelope, bound to "auth-config:github"
		clientSecretLast4: 'cret'
	})
);

// 2. Admin username is stored
await platform.env.KV.put('github_owner_username', 'your_username');

// When admin logs in for the first time:
// 3. Setup is permanently locked
await platform.env.KV.put('admin_first_login_completed', 'true');
```

---

## Secrets at rest

### What is encrypted

Before this was implemented, the claim "secrets stored encrypted in KV" was false: AI provider keys (`ai_key:<id>`) and OAuth client secrets (`auth_config:<provider>`) were stored as plain JSON. They are now sealed with AES-256-GCM before they are written.

| Value                                                                                       | Where                                            | Stored as                                                      |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| AI provider API keys                                                                        | KV `ai_key:<id>` field `apiKey`                  | Encrypted                                                      |
| OAuth client secrets (GitHub via `/setup`, Discord, others added in admin)                  | KV `auth_config:<provider>` field `clientSecret` | Encrypted                                                      |
| Last four characters of each, for the admin screen                                          | `apiKeyLast4`, `clientSecretLast4`               | Plaintext (hint only; omitted for secrets under 12 characters) |
| OAuth client IDs, key names, models, flags                                                  | same records                                     | Plaintext (not secret)                                         |
| Site API keys, stats API token                                                              | D1 / KV                                          | Already stored as one-way hashes; unchanged                    |
| Secrets you set as Worker secrets (`SESSION_SECRET`, `SETUP_SECRET`, `ENCRYPTION_KEY`, ...) | Cloudflare                                       | Never in KV or D1                                              |

The admin UI and API never return a stored secret. They return whether one is configured, the last four characters, and a status (`ok`, `legacy`, `undecryptable`).

### The key: `ENCRYPTION_KEY` (recommended) or an automatic one

```bash
bun run generate:encryption-key          # prints a base64 32-byte key
bunx wrangler pages secret put ENCRYPTION_KEY   # or Workers: bunx wrangler secret put ENCRYPTION_KEY
# local development: bun run generate:encryption-key --env  >> .dev.vars
```

**With `ENCRYPTION_KEY` set**, the key lives in Cloudflare's secret store and never in KV. Someone who can read your KV namespace (a leaked API token, a dump, a misconfigured export) sees only ciphertext. This is the real protection and what production should use.

**Without it**, the zero-environment promise holds: nothing breaks and nothing is stored in plaintext. On the first save, a random 32-byte key is generated and stored in KV as `encryption_key:auto`, and every secret is encrypted with it from then on. We chose this over refusing to save secrets (which would break the "deploy with no setup" flow) and over storing plaintext (which is what the template did before). Be clear about what it buys: anyone who can read the whole KV namespace reads the key beside the ciphertext, so it does **not** defend against KV compromise. It does stop the casual leaks: one record pasted into a ticket or log, a partial export, a backup of a single value, and it makes every value tamper-evident and non-transplantable (below). Set `ENCRYPTION_KEY` when the site holds anything you would mind losing.

Upgrading later is safe and needs no migration step: set `ENCRYPTION_KEY`, and the KV-held key keeps working as an accepted old key. Each value is re-encrypted with the new key the next time it is read, after which the KV key is no longer needed (leave it until you have viewed the AI Keys and Auth Keys admin pages, or call the API once, so every record gets rewritten).

A malformed `ENCRYPTION_KEY` (not base64, or not 32 bytes) is an error, never a silent fallback: saving a secret fails with a logged message instead of quietly using a different key.

### How it works

- Algorithm: AES-256-GCM through WebCrypto. Stored form: `v1.<base64url iv>.<base64url ciphertext>`; a fresh random 96-bit IV per value.
- One root secret serves every purpose: a separate subkey per purpose (`ai-key`, `auth-config`) is derived with HKDF-SHA-256, so a value for one purpose can never be opened as another.
- Associated data binds each ciphertext to `purpose:record id`. Copying the sealed `apiKey` from one record into another, or an OAuth secret from one provider to another, fails to decrypt. Any edit to the stored text fails authentication.
- If a value cannot be decrypted (the key was lost or changed without keeping the old one), the record stays visible with status `undecryptable`, the secret is treated as absent (the AI key is skipped, the provider counts as unconfigured), and nothing is overwritten. Re-enter the secret in the admin screen.
- Code: `src/lib/server/secret-box.ts` (crypto), `src/lib/server/secret-store.ts` (key resolution, KV records, migration).

### Rotating the key

1. `bun run generate:encryption-key` and set the new value as `ENCRYPTION_KEY`.
2. Set the old value as `ENCRYPTION_KEY_PREVIOUS` (comma separated for several).
3. Deploy. Values sealed with a previous key still open and are re-encrypted with the new key when read.
4. Open `/admin/ai-keys` and `/admin/auth-keys` once so every record is read, then remove `ENCRYPTION_KEY_PREVIOUS`.

### Existing plaintext

A site that saved keys before this change needs no action. A legacy plaintext value is returned as before and rewritten encrypted the first time it is read (and any edit or toggle of the record seals it). If the rewrite fails the read still succeeds and is retried next time.

### Limits

- KV has no compare-and-set. If two very first saves race with no `ENCRYPTION_KEY`, both read the key back after writing it and converge on whichever write won; only the owner (or the holder of `SETUP_SECRET` during bootstrap) can save secrets, so this needs two simultaneous first saves.
- A rewrite-on-read can overwrite a metadata edit made in the same instant. Records are small and owner-edited, so this was accepted rather than adding locking.
- Encryption protects the stored copy. The decrypted secret is in Worker memory while a request uses it, and it is sent to the provider as it must be.
- Environment-variable credentials (`GITHUB_CLIENT_SECRET` etc.) are Cloudflare secrets and take precedence over KV; they are not copied into KV.

---

## The `/reset` Page

### Purpose

The reset page allows you to clear all setup configuration and start fresh. This is useful for:

- Rotating OAuth credentials
- Changing the admin owner
- Recovering from misconfiguration
- Testing the setup flow

### What Gets Reset

| Cleared                          | Description              |
| -------------------------------- | ------------------------ |
| ✅ `auth_config:github`          | OAuth client credentials |
| ✅ `github_owner_id`             | Admin's GitHub user ID   |
| ✅ `github_owner_username`       | Admin's GitHub username  |
| ✅ `admin_first_login_completed` | Setup lock flag          |
| ✅ Session cookie                | Forces re-login          |

### What Is NOT Reset

| Preserved                | Description                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| ❌ User accounts         | All users in the D1 database                                                                                          |
| ❌ AI provider keys      | OpenAI, Anthropic, etc.                                                                                               |
| ❌ `encryption_key:auto` | The KV-held encryption key (see [Secrets at rest](#secrets-at-rest)); deleting it would make saved AI keys unreadable |
| ❌ Chat history          | Stored conversations                                                                                                  |
| ❌ Other app data        | Any other application state                                                                                           |

### Using the Reset Page

1. Navigate to `/reset`
2. Read the warning information
3. Click **"I understand, show reset option"**
4. Type `RESET` in the confirmation field
5. Click **"Reset Configuration"**
6. You'll be redirected to `/setup` to reconfigure

### Security Considerations

⚠️ **The reset page is accessible without authentication by default!**

This is intentional for recovery scenarios, but after initial setup you should:

1. Log in as the admin owner
2. Go to **Admin Panel → Settings**
3. **Disable the reset route**

Once disabled, the reset page will redirect to the home page.

```typescript
// Check in /reset page server load
const resetDisabled = await platform.env.KV.get('reset_route_disabled');
if (resetDisabled === 'true') {
	throw redirect(302, '/');
}
```

---

## Local Development

### Prerequisites

1. **Apply database migrations:**

   ```bash
   wrangler d1 execute nebulakit-db --local --file=migrations/schema.sql
   ```

2. **Create KV namespaces** (for persistent local storage):

   ```bash
   wrangler kv:namespace create "KV" --preview
   ```

3. **Update `wrangler.toml`** with the preview ID:
   ```toml
   [[kv_namespaces]]
   binding = "KV"
   preview_id = "your_preview_id"
   ```

### Local Setup Flow

1. Start the dev server:

   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:4277/setup`

3. Create a GitHub OAuth App with:
   - **Homepage URL:** `http://localhost:4277`
   - **Callback URL:** `http://localhost:4277/api/auth/github/callback`

4. Complete the setup form and log in

Your credentials will persist across dev server restarts in the local KV preview namespace.

---

## Production Deployment

### Cloudflare Pages Deployment

1. **Deploy to Cloudflare Pages** - No environment variables needed!

2. **Create KV namespace:**

   ```bash
   wrangler kv:namespace create "KV"
   ```

3. **Bind KV to your Pages project** in the Cloudflare dashboard:
   - Go to Pages → Your Project → Settings → Functions
   - Add KV namespace binding: `KV` → your namespace

4. **Navigate to your deployed app's `/setup` page**

5. **Complete setup** with production OAuth credentials

6. **Log in as admin** to lock the setup

7. **Disable the reset route** from the admin panel

---

## API Endpoints

### GET `/api/setup`

Returns the current setup status.

**Response:**

```json
{
	"hasConfig": true, // OAuth credentials exist
	"hasAdmin": true, // Admin username is set
	"setupLocked": false // Admin has logged in (locks setup)
}
```

### POST `/api/setup`

Saves OAuth configuration.

**Request:**

```json
{
	"provider": "github",
	"clientId": "your_client_id",
	"clientSecret": "your_client_secret",
	"adminGithubUsername": "your_username"
}
```

**Response:**

```json
{
	"success": true,
	"message": "Configuration saved successfully!"
}
```

### POST `/api/reset`

Clears all setup configuration.

**Response:**

```json
{
	"success": true,
	"message": "Configuration reset successfully. You will be redirected to the setup page."
}
```

---

## Troubleshooting

### "Setup is locked" Error

The admin has already logged in, permanently locking setup. To reconfigure:

1. Go to `/reset` (if not disabled)
2. Complete the reset process
3. Run through `/setup` again

### "OAuth not configured" Error

You're trying to log in before completing setup:

1. Go to `/setup`
2. Enter your OAuth credentials
3. Try logging in again

### Reset Page Redirects to Home

The admin has disabled the reset route. To re-enable:

1. Log in as the admin
2. Go to Admin Panel → Settings
3. Enable the reset route
4. Navigate to `/reset`

### KV Not Available (Local Dev)

Ensure you've created a preview KV namespace and updated `wrangler.toml`:

```bash
wrangler kv:namespace create "KV" --preview
```

---

## Security Best Practices

1. **Always disable `/reset` in production** after initial setup
2. **Use strong OAuth secrets** - Let GitHub generate them
3. **Verify the admin username** before first login
4. **Set `ENCRYPTION_KEY`** so a KV leak does not also leak the encryption key
5. **Monitor the admin panel** for unauthorized access attempts
6. **Rotate OAuth secrets periodically** via the reset flow

---

## Related Documentation

- [LOCAL_SETUP.md](./LOCAL_SETUP.md) - Detailed local development setup
- [GITHUB_AUTH.md](./GITHUB_AUTH.md) - GitHub OAuth configuration details
