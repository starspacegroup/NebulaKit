# NebulaKit Features

## 🚀 Cloudflare Full Stack Integration

### D1 Database
- Serverless SQL database
- Pre-configured bindings in `app.d.ts`
- Ready for user data, sessions, and more
- Example schema included in setup guide

### KV Storage
- High-performance key-value storage
- Perfect for caching and session management
- Global distribution
- Simple API: `platform.env.KV.get()`, `platform.env.KV.put()`

### R2 Object Storage
- S3-compatible object storage
- No egress fees
- Perfect for user uploads, media files
- Access via `platform.env.BUCKET`

### Queues
- Background job processing
- Reliable message delivery
- Batch processing support
- Configured via `wrangler.toml`

### Turnstile
- CAPTCHA alternative
- Privacy-focused
- Better UX than traditional CAPTCHAs
- Easy integration in auth flows

## 🎨 Theme System

### Light & Dark Modes
- System preference detection
- Persistent user preference (localStorage)
- Smooth transitions between themes
- Floating theme switcher button

### CSS Variables
All theme values are customizable via CSS variables:
- Colors: `--color-primary`, `--color-background`, etc.
- Spacing: `--spacing-sm`, `--spacing-md`, etc.
- Border radius: `--radius-sm`, `--radius-md`, etc.
- Shadows: `--shadow-sm`, `--shadow-lg`, etc.
- Typography: `--font-sans`, `--font-mono`

### Extensible
Add custom themes by creating new data attributes:
```css
[data-theme='custom'] {
  --color-primary: #your-color;
  /* ... */
}
```

## ⌨️ Command Palette

### Features
- Keyboard-first navigation (Cmd/Ctrl + K)
- Search functionality
- Arrow key navigation
- Fuzzy search support
- Extensible command system

### Adding Commands
Edit `CommandPalette.svelte` to add new commands:
```typescript
{
  id: 'custom',
  label: 'Custom Action',
  description: 'Description',
  action: () => { /* your code */ },
  icon: '🎯'
}
```

## 💬 LLM Chat UI

### Features
- Modern chat interface
- Typing indicators
- Message history
- Responsive design
- Auto-scroll to new messages
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)

### Integration
Connect to your LLM API by modifying the `sendMessage` function in `/routes/chat/+page.svelte`:
```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: input })
});
```

## 🔐 Authentication System

### Supported Methods
- Email/password authentication
- SSO with Google
- SSO with GitHub
- Account linking ready
- Session management

### Components
- Login page (`/auth/login`)
- Signup page (`/auth/signup`)
- Pre-styled forms
- SSO buttons with provider logos
- Error handling

### Adding Providers
Use [@auth/sveltekit](https://authjs.dev/getting-started/installation?framework=sveltekit) for OAuth providers:
```typescript
import Google from '@auth/sveltekit/providers/google'
import GitHub from '@auth/sveltekit/providers/github'
```

## 📱 Mobile-First Design

### Responsive Layouts
- Breakpoints: 640px, 768px, 1024px, 1280px
- Grid system adapts to screen size
- Touch-optimized interactions
- Mobile navigation menu

### Performance
- Optimized bundle sizes
- Code splitting
- Lazy loading
- Fast page transitions

## 🎯 Drag & Drop System

### Features
- Desktop drag and drop
- Mobile touch support
- Cross-column dragging
- Visual feedback
- Smooth animations

### Usage
The demo page shows a kanban board implementation. Extend it for your needs:
```typescript
function handleDrop(e: DragEvent, targetId: string) {
  // Your drop logic
}
```

### Mobile Support
Touch events are handled separately for better mobile UX:
```typescript
handleTouchStart(e: TouchEvent, item: Item) { }
handleTouchMove(e: TouchEvent) { }
handleTouchEnd(e: TouchEvent) { }
```

## 🎨 UI Components

### Navigation
- Sticky header
- Mobile hamburger menu
- Active link highlighting
- Smooth transitions

### Buttons
Multiple variants included:
- Primary buttons (`.btn-primary`)
- Secondary buttons (`.btn-secondary`)
- Outline buttons (`.btn-outline`)
- SSO buttons (`.sso-button`)

### Forms
- Accessible form controls
- Focus states
- Error messages
- Label associations
- Input validation

### Cards
- Feature cards
- Elevated on hover
- Smooth shadows
- Responsive grid

## 🛠️ Developer Experience

### TypeScript
- Full type safety
- Platform types included
- Cloudflare Workers types
- Type-safe routing

### Hot Module Replacement
- Instant updates during development
- State preservation
- Fast rebuilds

### Build Optimization
- Tree shaking
- Code splitting
- CSS optimization
- Asset optimization

## 🔒 Security

### Best Practices
- CSRF protection (SvelteKit built-in)
- XSS prevention
- Content Security Policy ready
- Secure session handling
- Turnstile for bot protection

## 📦 Deployment

### Cloudflare Pages
- Automatic deployments from Git
- Preview deployments for PRs
- Global CDN distribution
- Zero config needed

### Environment
- Production/staging environments
- Environment variables support
- Secrets management
- Rollback support

## 🎓 Learning Resources

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Auth.js Documentation](https://authjs.dev/)
- [Svelte Tutorial](https://svelte.dev/tutorial)
