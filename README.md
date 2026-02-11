# buZplanet

A multilingual SvelteKit application deployed on Cloudflare Pages with automated versioning and deployment.

## 🚀 Quick Start

This project was created with Svelte's CLI and configured for Cloudflare Pages deployment. Here's how to get started:

### Prerequisites

- Node.js 18+
- npm or pnpm
- Git (for version control)
- Cloudflare account (for deployment)

### Development

```bash
# Clone the repository
git clone <repository-url>
cd buzplanet

# Install dependencies
npm install

# Start development server (localhost:5600)
npm run dev
```

### Building & Deployment

```bash
# Build for production
npm run build

# Deploy to Cloudflare Pages (auto-bumps version)
npm run deploy

# Deploy to production environment
npm run deploy:production
```

## 📚 Project Setup History

This section documents the complete setup process from scratch:

### 1. Initial Project Creation

```bash
# Create new SvelteKit project with Cloudflare adapter
npx sv create buZplanet
```

During setup, the following options were selected:

- **Template**: minimal
- **TypeScript**: Yes
- **Add-ons**:
  - Paraglide (i18n): `languageTags:en, fr, es+demo:no`
  - Prettier (code formatting)
  - TailwindCSS: `plugins:none`
  - SvelteKit Adapter: `adapter:cloudflare+cfTarget:workers`
- **Package Manager**: npm

### 2. Cloudflare Configuration

#### Created `wrangler.toml`

```toml
name = "buzplanet"
compatibility_date = "2024-12-19"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".svelte-kit/cloudflare"

[env.production]
vars = {}

[env.preview]
vars = {}
```

#### Cloudflare Authentication

```bash
# Login to Cloudflare (opens browser for authentication)
wrangler login
```

### 3. Automated Versioning System

#### Created Version Bump Script

Created `scripts/bump-version.mjs` for semantic versioning:

- Supports `patch`, `minor`, and `major` version bumps
- Updates `package.json` automatically
- Creates git commits for version changes
- Integrates with deployment workflow

#### Updated Package Scripts

Added the following scripts to `package.json`:

```json
{
	"scripts": {
		"deploy": "npm run version:patch && npm run build && wrangler pages deploy .svelte-kit/cloudflare",
		"deploy:production": "npm run version:patch && npm run build && wrangler pages deploy --env production",
		"version:patch": "node scripts/bump-version.mjs patch",
		"version:minor": "node scripts/bump-version.mjs minor",
		"version:major": "node scripts/bump-version.mjs major",
		"preview": "wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-12-19 --compatibility-flags=nodejs_compat --port 4173",
		"gen": "wrangler types"
	}
}
```

### 4. Development Configuration

#### Updated `vite.config.ts`

- Added version tracking from `package.json`
- Set development server to port 5600
- Added build-time constants for version display
- Configured PWA support with version tracking

#### Updated `svelte.config.js`

- Enabled service worker registration
- Added paraglide alias for i18n
- Configured Cloudflare adapter

## 🛠 Available Scripts

| Script                      | Description                                |
| --------------------------- | ------------------------------------------ |
| `npm run dev`               | Start development server on localhost:5600 |
| `npm run build`             | Build for production                       |
| `npm run preview`           | Preview build using Wrangler               |
| `npm run deploy`            | Bump patch version, build, and deploy      |
| `npm run deploy:production` | Deploy to production environment           |
| `npm run version:patch`     | Bump patch version (0.0.1 → 0.0.2)         |
| `npm run version:minor`     | Bump minor version (0.1.0 → 0.2.0)         |
| `npm run version:major`     | Bump major version (1.0.0 → 2.0.0)         |
| `npm run gen`               | Generate Cloudflare types                  |
| `npm run check`             | Run Svelte type checking                   |
| `npm run lint`              | Check code formatting                      |
| `npm run format`            | Format code with Prettier                  |

## 🌍 Internationalization

This project uses Paraglide for i18n with support for:

- English (en)
- French (fr)
- Spanish (es)

Translation files are managed in the `project.inlang/` directory.

## 🎨 Styling

Built with TailwindCSS v4 for modern, utility-first styling.

## 🚢 Deployment

Deployment is handled through Cloudflare Pages:

1. **Automatic Versioning**: Each deployment automatically increments the patch version
2. **Environment Support**: Separate preview and production environments
3. **Build Optimization**: Optimized for Cloudflare's edge network

### Manual Deployment Steps

```bash
# 1. Authenticate with Cloudflare (one-time setup)
wrangler login

# 2. Deploy to preview
npm run deploy

# 3. Deploy to production
npm run deploy:production
```

## 📝 Version Management

Version bumping is automated through custom scripts:

```bash
# Patch version (bug fixes): 0.0.1 → 0.0.2
npm run version:patch

# Minor version (new features): 0.1.0 → 0.2.0
npm run version:minor

# Major version (breaking changes): 1.0.0 → 2.0.0
npm run version:major
```

Each version bump:

- Updates `package.json`
- Creates a git commit
- Can be combined with deployment

## 🔧 Project Structure

```
buzplanet/
├── src/                    # Source code
├── static/                 # Static assets
├── scripts/               # Build scripts
│   └── bump-version.mjs   # Version management
├── project.inlang/        # Internationalization
├── wrangler.toml         # Cloudflare configuration
├── vite.config.ts        # Vite configuration
├── svelte.config.js      # Svelte configuration
└── package.json          # Dependencies and scripts
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev`
5. Submit a pull request

## 📄 License

This project is private. All rights reserved.

### r2 files

wrangler r2 bucket create mbtiles

wrangler r2 object put mbtiles/transportation_asia_japan_kanto.mbtiles \
 --file /home/bmodave/coding/data/mbtiles/transportation_asia_japan_kanto.mbtiles \
 --content-type application/x-sqlite3 \
 --cache-control "public, max-age=31536000, immutable" \
 --remote

### Worker

https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/

To Fix

- set tables in drawers to be mobile responsive

To Build

- click on row triggers a sub-drawer with details and map
- click on class subclass or category and update the table
- Add Stories
