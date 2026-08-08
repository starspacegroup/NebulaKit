# GitHub OAuth Configuration Guide

## Overview

NebulaKit now supports GitHub OAuth authentication. Once configured, users can sign in with their GitHub account, and the OAuth app owner will have access to the admin panel.

## Setup Process

### 1. Create GitHub OAuth App

**IMPORTANT:** You must create a real GitHub OAuth App first. The app will not work with mock credentials.

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the application details:
   - **Application name**: NebulaKit (or your preferred name)
   - **Homepage URL**: `http://localhost:4277` (for development)
   - **Authorization callback URL**: `http://localhost:4277/api/auth/github/callback`
4. Click **"Register application"**
5. You'll see your **Client ID** on the next page
6. Click **"Generate a new client secret"** to get your **Client Secret**
7. Copy both values immediately (you won't be able to see the secret again)

### 2. Configure Locally (Development)

For local development, you have two options:

**Option A: Using .dev.vars (Recommended for local testing)**

Create a `.dev.vars` file in the project root:

```env
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_OWNER_ID=your_github_user_id_here
SESSION_SECRET=generate_a_random_secret_here
SETUP_SECRET=generate_a_different_random_secret_here
```

**Option B: Using wrangler.toml**

Add or uncomment in `wrangler.toml` under the `[vars]` section:

```toml
[vars]
GITHUB_OWNER_ID = "your_github_user_id_here"
```

**Option C: Using the /setup page**

Set `SESSION_SECRET` and `SETUP_SECRET`, then visit `/setup` and enter the setup secret, OAuth
credentials, and owner username. Once an owner or provider configuration exists, only the
authenticated owner can change setup.

#### Finding Your GitHub User ID

To enable admin access, you need to set your GitHub user ID. Here's how to find it:

**Method 1: GitHub API (Easiest)**
Visit: `https://api.github.com/users/YOUR_USERNAME`

Look for the `"id"` field in the JSON response (it's a number, not a string).

**Method 2: Using curl/PowerShell**

```powershell
# PowerShell
(Invoke-WebRequest "https://api.github.com/users/YOUR_USERNAME").Content | ConvertFrom-Json | Select-Object id

# Or use curl
curl https://api.github.com/users/YOUR_USERNAME
```

**Example:**

```json
{
  "login": "octocat",
  "id": 583231,  // <-- This is your GITHUB_OWNER_ID
  "name": "The Octocat",
  ...
}
```

### 3. Environment Variables (Production)

For Cloudflare Workers deployment, set these environment variables:

```bash
# Set secrets (for sensitive data)
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put SESSION_SECRET
wrangler secret put SETUP_SECRET

# Set vars (can be public, defined in wrangler.toml or set via CLI)
wrangler secret put GITHUB_OWNER_ID
```

Or update `wrangler.toml`:

```toml
[vars]
GITHUB_OWNER_ID = "583231"  # Replace with your actual GitHub user ID
```

**Environment Variable Details:**

- `GITHUB_CLIENT_ID`: Your GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET`: Your GitHub OAuth App Client Secret
- `GITHUB_OWNER_ID`: Your GitHub user ID (numeric) - **only this user can access /admin**
- `SESSION_SECRET`: Random secret used to sign opaque session and OAuth-state cookies
- `SETUP_SECRET`: Separate bearer secret accepted only during first-time bootstrap

⚠️ **Important:** Without setting `GITHUB_OWNER_ID`, you will be able to log in with GitHub, but `isOwner` will be `false` and you won't have admin access.

## How It Works

### Authentication Flow

1. **Login**: User clicks "Continue with GitHub" on `/auth/login`
2. **OAuth**: User is redirected to GitHub to authorize the app
3. **Callback**: GitHub redirects back to `/api/auth/github/callback` with an authorization code
4. **Token Exchange**: The app exchanges the code for an access token
5. **User Info**: The app fetches user details from GitHub API
6. **Session**: An opaque token is signed into the cookie; its digest, expiry, identity, and current roles are stored in D1
7. **Redirect**:
   - Owners and administrators are redirected to `/admin`
   - Normal users are redirected to the home page

Discord does not establish a new owner identity. Setup establishes ownership from the configured
GitHub identity; a Discord login receives owner status only when it resolves to that same canonical
account through an existing link or an unambiguous email match. A standalone Discord account remains
a normal user unless an owner later grants it administrator access.

### Logout / return-to behavior — design decision (2026-07-14)

The decided behavior (see `planning/DECISIONS.md` in the planning repo):

- **Logout from a public page** → stay on that page (just with the session cleared).
- **Logout from a login-required page** → go to `/auth/login`, carrying a
  return-to reference to the page the user was on.
- **Logging back in** → return the user to the page they were on, not `/admin`
  or home unconditionally.

**Status: not yet implemented.** `src/routes/api/auth/logout/+server.ts` currently
redirects to `/auth/login` unconditionally, and the OAuth callback ignores any
return-to target. When implementing: validate the return-to value as a same-origin
relative path (no absolute/protocol-relative URLs) to avoid an open-redirect.

### Admin Access Control

- **Protected Routes**: All routes under `/admin` require authentication
- **Admin Access**: Authenticated owners and users granted admin rights can access `/admin`
- **Owner-Only Controls**: Only the owner can manage authentication keys or reset setup
- **Server-Side Check**: Protection is enforced server-side in `+layout.server.ts`

### User Interface

- **Navigation**: Shows "Admin" link only for the OAuth app owner
- **User Menu**: Displays logged-in user's name and logout button
- **Sign In**: Shows "Sign In" button for unauthenticated users

## Routes

- `/setup` - Initial setup page for GitHub OAuth configuration
- `/auth/login` - Login page with GitHub OAuth button
- `/api/auth/logout` - Logout endpoint (GET or POST)
- `/api/auth/github` - OAuth initiation (redirects to GitHub)
- `/api/auth/github/callback` - OAuth callback handler
- `/admin` - Admin panel (admin/owner session required)

## Security Features

- **Session Cookies**: HTTP-only, secure (in production), SameSite=lax
- **Revocable Sessions**: Identity and roles are reloaded from D1 on every request
- **OAuth State**: GitHub and Discord validate provider-specific signed state and unexpired D1 transactions before exchanging the authorization code. The transaction is atomically consumed after a successful token exchange, preventing replay while allowing safe retry when provider authentication did not complete.
- **Owner Verification**: Compares GitHub user ID with stored owner ID
- **Owner-Only Operations**: Authentication-key administration and reset require the owner; reset revokes all active sessions
- **Server-Side Protection**: All admin routes protected by layout load function
- **Token Security**: Access tokens never stored in browser

## Testing

All authentication features are covered by tests:

```bash
# Run auth-related tests
bunx vitest run tests/unit/github-auth.test.ts tests/unit/admin-protection.test.ts

# All tests should pass:
# ✓ github-auth.test.ts (9 tests)
# ✓ admin-protection.test.ts (6 tests)
```

## Development

The implementation follows TDD principles and contributes to the enforced 95% coverage floor.

### Key Files

- `src/hooks.server.ts` - Authentication hook
- `src/routes/api/auth/github/+server.ts` - OAuth initiation
- `src/routes/api/auth/github/callback/+server.ts` - OAuth callback
- `src/routes/admin/+layout.server.ts` - Admin route protection
- `src/lib/components/Navigation.svelte` - User menu and conditional admin link

## Production Considerations

1. **Secrets Management**: Use Cloudflare Workers secrets, never commit credentials
2. **Session Storage**: Apply D1 migrations before enabling login; authentication fails closed without D1
3. **Secret Separation**: Use different high-entropy values for `SESSION_SECRET` and `SETUP_SECRET`
4. **HTTPS**: Always use HTTPS in production for secure cookies
5. **Error Handling**: Implement proper error logging and user feedback
6. **Reset**: Restrict `/reset` operationally as well as through its owner-only application policy
