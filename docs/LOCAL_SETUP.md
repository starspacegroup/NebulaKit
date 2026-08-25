# Local Development Setup for NebulaKit

## Database Migrations

**⚠️ IMPORTANT: Run this first before starting development!**

Apply database migrations to create all required tables:

```bash
bun run db:migrate:local
```

This creates:

- `users` - User accounts
- `sessions` - Session management
- `oauth_accounts` - OAuth provider linking
- `chat_messages` - Chat history

Verify tables were created:

```bash
bunx wrangler d1 execute nebulakit-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## KV Namespace Setup

For local development with persistent KV storage, you need to create a preview KV namespace:

### 1. Create KV Namespaces

```bash
# Create production KV namespace
bunx wrangler kv namespace create "KV"

# Create preview KV namespace for local dev
bunx wrangler kv namespace create "KV" --preview
```

### 2. Update wrangler.toml

After running the commands above, you'll get output like:

```
🌀 Creating namespace with title "nebulakit-KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "KV", id = "abc123..." }

🌀 Creating namespace with title "nebulakit-KV_preview"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "KV", preview_id = "xyz789..." }
```

Update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "abc123..."           # Your production KV ID
preview_id = "xyz789..."   # Your preview KV ID for local dev
```

### 3. Test KV Storage

Run the dev server:

```bash
bun run dev
```

Now when you save GitHub OAuth credentials via `/setup`, they'll be stored in your local preview KV namespace and persist across dev server restarts!

### 4. Verify It's Working

1. Go to `http://localhost:4277/setup`
2. Enter your GitHub OAuth credentials
3. Check the console - you should see: `✓ Saved auth config to KV`
4. Try logging in with GitHub - it should work!
5. Restart the dev server - your credentials are still there!

## Environment-backed authentication

OAuth credentials can come from environment variables instead of the KV-backed setup form. The
project-owned KV binding remains required for runtime configuration, and D1 stores revocable
sessions.

Create `.dev.vars` in the project root:

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_OWNER_ID=your_github_user_id
SESSION_SECRET=generate_a_high_entropy_session_secret
SETUP_SECRET=generate_a_different_bootstrap_secret
```

The app will check environment variables first, then fall back to KV storage.

## Production Deployment

For production on Cloudflare Pages/Workers:

```bash
# Set secrets (more secure than environment variables)
bunx wrangler secret put GITHUB_CLIENT_ID
bunx wrangler secret put GITHUB_CLIENT_SECRET
bunx wrangler secret put SESSION_SECRET
bunx wrangler secret put SETUP_SECRET
```

Set `GITHUB_OWNER_ID` as a production variable. Alternatively, use `/setup` with `SETUP_SECRET`;
provider credentials are saved to the production KV namespace, and only the authenticated owner can
change them after bootstrap.
