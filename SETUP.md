# NebulaKit Setup Guide

## Prerequisites

- Bun 1.3.14+ installed
- Node.js 22+ for Node-based utility scripts
- Cloudflare account (for deployment)
- Git

## Installation

Clone the NebulaKit product repository directly:

```bash
git clone https://github.com/starspacegroup/NebulaKit.git
cd NebulaKit
```

## Next Steps

1. Install dependencies:

```bash
bun install
```

2. Create **this project's own** Cloudflare resources:

```bash
bunx wrangler login
bun run setup:cf
```

That creates a D1 database, a KV namespace and its preview namespace, and
writes their ids into `wrangler.toml`. Never paste ids from another project —
Cloudflare binds D1 and KV by **id**, not by name, so a copied id attaches your
app to somebody else's data and every query succeeds. The repository ships
`REPLACE_ME_*` placeholders and a guard that fails the build until they are
real. See [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md).

3. Apply the database migrations:

```bash
bun run db:migrate
```

4. Configure separate authentication secrets before using `/setup`:

```bash
# Generate two different high-entropy values and place them in .dev.vars locally
openssl rand -base64 32
openssl rand -base64 32
```

Use one value for `SESSION_SECRET` and the other for `SETUP_SECRET`. The first signs opaque session
tokens whose digests are stored in D1; the second authorizes initial owner bootstrap only.

5. Optional extras:
   - R2 bucket, if you use file storage: `bunx wrangler r2 bucket create nebulakit-files`
   - Turnstile, at https://dash.cloudflare.com/

## Development

Start the development server:

```bash
bun run dev
```

The app will be available at `http://localhost:4277`

## Building

Build for production:

```bash
bun run build
```

Preview the production build:

```bash
bun run preview
```

## Deployment to Cloudflare Pages

1. Authenticate with Wrangler:

```bash
bunx wrangler login
```

2. Deploy to Cloudflare Pages:

```bash
bun run deploy
```

Or connect your GitHub repository to Cloudflare Pages for automatic deployments.

## Cloudflare Configuration

### D1 Database

Apply database migrations:

```bash
# Apply migrations to remote D1
bun run db:migrate

# Apply migrations to local D1 (for development)
bun run db:migrate:local

# Check which migrations have been applied
bun run db:migrate:list
```

D1 automatically tracks which migrations have been applied and skips them on subsequent runs. See `migrations/README.md` for details on creating new migrations.

### KV Namespace

Used for runtime configuration and feature flags. Revocable session records live in D1, not KV.

### R2 Bucket

Used for file uploads. Configure CORS if needed:

```json
[
	{
		"AllowedOrigins": ["*"],
		"AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
		"AllowedHeaders": ["*"]
	}
]
```

### Queues

Queue bindings are disabled in the shipped configuration. Do not claim queue processing unless a
producer and consumer are intentionally implemented and configured.

### Turnstile

1. Create a Turnstile site at https://dash.cloudflare.com/
2. Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` together
3. Leave both absent to disable Turnstile; setting only one is invalid and fails closed

## Environment Variables

Create `.dev.vars` for local development:

```env
SESSION_SECRET=generate-a-high-entropy-session-secret
SETUP_SECRET=generate-a-different-bootstrap-secret
TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key
```

For production, set these in Cloudflare Pages settings.

## Project Structure

```
NebulaKit/
├── src/
│   ├── lib/
│   │   ├── components/     # Reusable UI components
│   │   ├── stores/         # Svelte stores
│   │   ├── server/         # Server-side utilities
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   ├── routes/             # SvelteKit routes
│   │   ├── admin/         # Protected operator surfaces
│   │   ├── auth/          # Authentication pages
│   │   ├── chat/          # Chat interface
│   │   └── documentation/ # Shipped operator guide
│   ├── app.css            # Global styles
│   ├── app.html           # HTML template
│   └── app.d.ts           # Type definitions
├── static/                 # Static assets
├── wrangler.toml          # Cloudflare configuration
└── svelte.config.js       # SvelteKit configuration
```

## Next Steps

- Configure authentication providers through `/setup` or environment secrets
- Configure enabled chat/voice models under `/admin/ai-keys`
- Review the theme system
- Extend the database only through a new immutable migration
- Review the included GitHub Actions checks before deployment
