# NebulaKit Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm or pnpm
- Cloudflare account (for deployment)
- Wrangler CLI installed: `npm install -g wrangler`

## Installation

### Option 1: Use the GitHub Template (Recommended)

The easiest way to get started is to use the **"Use this template"** button on GitHub:

1. Go to the [NebulaKit repository](https://github.com/starspacegroup/NebulaKit)
2. Click the green **"Use this template"** button
3. Choose one of:
   - **Create a new repository** - Creates your own copy of NebulaKit in your GitHub account
   - **Open in a codespace** - Instantly spin up a cloud development environment
4. If you created a new repository, clone it:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### Option 2: Clone the Repository

Alternatively, clone the repository directly:

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
npx wrangler login
bun run setup:cf
```

That creates a D1 database, a KV namespace and its preview namespace, and
writes their ids into `wrangler.toml`. Never paste ids from another project —
Cloudflare binds D1 and KV by **id**, not by name, so a copied id attaches your
app to somebody else's data and every query succeeds. The template ships
`REPLACE_ME_*` placeholders and a guard that fails the build until they are
real. See [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md).

3. Apply the database migrations:

```bash
bun run db:migrate
```

4. Optional extras:
   - R2 bucket, if you use file storage: `npx wrangler r2 bucket create <project>-files`
   - Turnstile, at https://dash.cloudflare.com/

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:4277`

## Building

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Deployment to Cloudflare Pages

1. Authenticate with Wrangler:

```bash
wrangler login
```

2. Deploy to Cloudflare Pages:

```bash
npm run deploy
```

Or connect your GitHub repository to Cloudflare Pages for automatic deployments.

## Cloudflare Configuration

### D1 Database

Apply database migrations:

```bash
# Apply migrations to remote D1
npm run db:migrate

# Apply migrations to local D1 (for development)
npm run db:migrate:local

# Check which migrations have been applied
npm run db:migrate:list
```

D1 automatically tracks which migrations have been applied and skips them on subsequent runs. See `migrations/README.md` for details on creating new migrations.

### KV Namespace

Used for caching and session storage. No additional setup required.

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

Configure background job processing. Messages are automatically processed by the worker.

### Turnstile

1. Create a Turnstile site at https://dash.cloudflare.com/
2. Add the site key to your frontend
3. Add the secret key to `wrangler.toml` or environment variables

## Environment Variables

Create a `.env` file for local development:

```
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
│   │   ├── auth/          # Authentication pages
│   │   ├── chat/          # Chat interface
│   │   └── demo/          # Feature demos
│   ├── app.css            # Global styles
│   ├── app.html           # HTML template
│   └── app.d.ts           # Type definitions
├── static/                 # Static assets
├── wrangler.toml          # Cloudflare configuration
└── svelte.config.js       # SvelteKit configuration
```

## Next Steps

- Configure authentication providers in your auth flow
- Connect the chat UI to your LLM API
- Customize the theme system
- Add your database schema and migrations
- Set up CI/CD with GitHub Actions
