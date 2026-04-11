# Zero Environment Variable Setup Guide (Optional)

> **💡 Recommended:** For production deployments, we recommend using **secure environment variables** in Cloudflare Pages. See the [Deployment documentation](../src/routes/documentation/+page.svelte) for details.
>
> The zero-config setup described below is an **alternative approach** for scenarios where you want to configure credentials via a web UI instead.

---

## Getting Started

[![Use this template](https://img.shields.io/badge/Use%20this%20template-238636?style=for-the-badge&logo=github&logoColor=white)](https://github.com/new?template_name=NebulaKit&template_owner=starspacegroup)

Click the button above to create your own repository from the NebulaKit template, then follow the setup instructions below.

---

NebulaKit can work **without any pre-configured environment variables**. Instead of relying on `.env` files or manually set secrets, all configuration is done through a web-based setup flow and stored securely in Cloudflare KV.

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
- ✅ Secrets stored encrypted in Cloudflare KV
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
// 1. OAuth credentials are stored in KV
await platform.env.KV.put(
	'auth_config:github',
	JSON.stringify({
		clientId: 'your_client_id',
		clientSecret: 'your_client_secret'
	})
);

// 2. Admin username is stored
await platform.env.KV.put('github_owner_username', 'your_username');

// When admin logs in for the first time:
// 3. Setup is permanently locked
await platform.env.KV.put('admin_first_login_completed', 'true');
```

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

| Preserved           | Description                  |
| ------------------- | ---------------------------- |
| ❌ User accounts    | All users in the D1 database |
| ❌ AI provider keys | OpenAI, Anthropic, etc.      |
| ❌ Chat history     | Stored conversations         |
| ❌ Other app data   | Any other application state  |

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
4. **Monitor the admin panel** for unauthorized access attempts
5. **Rotate OAuth secrets periodically** via the reset flow

---

## Related Documentation

- [LOCAL_SETUP.md](./LOCAL_SETUP.md) - Detailed local development setup
- [GITHUB_AUTH.md](./GITHUB_AUTH.md) - GitHub OAuth configuration details
