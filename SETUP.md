# NebulaKit Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm or pnpm
- Cloudflare account (for deployment)
- Wrangler CLI installed: `npm install -g wrangler`

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd NebulaKit
```

2. Install dependencies:
```bash
npm install
```

3. Configure Cloudflare bindings:
   - Copy `wrangler.toml` and update with your Cloudflare resource IDs
   - Create D1 database: `wrangler d1 create nebulakit-db`
   - Create KV namespace: `wrangler kv:namespace create "KV"`
   - Create R2 bucket: `wrangler r2 bucket create nebulakit-files`
   - Set up Turnstile at https://dash.cloudflare.com/

## Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

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

Create tables for your application:
```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

Run migrations:
```bash
wrangler d1 execute nebulakit-db --file=./migrations/schema.sql
```

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
