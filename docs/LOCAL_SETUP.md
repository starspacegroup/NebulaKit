# Local Development Setup for NebulaKit

## Database Migrations

**⚠️ IMPORTANT: Run this first before starting development!**

Apply database migrations to create all required tables:

```bash
wrangler d1 execute nebulakit-db --local --file=migrations/schema.sql
```

This creates:

- `users` - User accounts
- `sessions` - Session management
- `oauth_accounts` - OAuth provider linking
- `chat_messages` - Chat history

Verify tables were created:

```bash
wrangler d1 execute nebulakit-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## KV Namespace Setup

For local development with persistent KV storage, you need to create a preview KV namespace:

### 1. Create KV Namespaces

```bash
# Create production KV namespace
wrangler kv:namespace create "KV"

# Create preview KV namespace for local dev
wrangler kv:namespace create "KV" --preview
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
npm run dev
```

Now when you save GitHub OAuth credentials via `/setup`, they'll be stored in your local preview KV namespace and persist across dev server restarts!

### 4. Verify It's Working

1. Go to `http://localhost:5173/setup`
2. Enter your GitHub OAuth credentials
3. Check the console - you should see: `✓ Saved auth config to KV`
4. Try logging in with GitHub - it should work!
5. Restart the dev server - your credentials are still there!

## Alternative: Use .dev.vars

If you prefer not to set up KV, you can still use environment variables:

Create `.dev.vars` in the project root:

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_OWNER_ID=your_github_user_id
```

The app will check environment variables first, then fall back to KV storage.

## Production Deployment

For production on Cloudflare Pages/Workers:

```bash
# Set secrets (more secure than environment variables)
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GITHUB_OWNER_ID
```

Or use the `/setup` page in production - credentials will be saved to your production KV namespace.
