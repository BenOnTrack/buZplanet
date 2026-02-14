# buZplanet

A multilingual SvelteKit application for discovering, bookmarking, and storytelling about map features with **full cross-device synchronization**. Deployed on Cloudflare Pages with automated versioning and deployment.

## 🌟 Key Features

- **Interactive Map Interface**: Explore and discover map features with detailed information
- **Feature Bookmarking**: Save interesting locations with visits, todo lists, and custom bookmark lists
- **Story Creation**: Create rich stories that combine text and map features
- **✅ Cross-Device Sync**: Seamless real-time synchronization across all your devices
- **Offline Support**: Full functionality even when offline, with sync when reconnected
- **User Authentication**: Secure account system with Google Sign-In support
- **Multilingual**: Support for English, French, and Spanish

## 🔄 Cross-Device Synchronization - **CONFIRMED WORKING** ✅

### **Real-Time Sync Verified**

Both **Features** and **Stories** are fully synchronized across all your devices. When you log in with the same account on mobile and desktop, all changes sync automatically in real-time.

#### **What Syncs Across Devices:**

**Features:**

- ✅ **Bookmarks**: Add/remove bookmarks on any device
- ✅ **Visits**: Track visits to locations across devices
- ✅ **Todo Lists**: Manage your todo items everywhere
- ✅ **Bookmark Lists**: Organize features in custom lists
- ✅ **Real-time Updates**: Changes appear instantly on all devices

**Stories:**

- ✅ **Create Stories**: New stories sync immediately
- ✅ **Edit Content**: Story updates propagate in real-time
- ✅ **Delete Stories**: Deletions sync across all devices
- ✅ **Rich Content**: Text and embedded map features sync together

### **Sync Flow Example:**

#### 📱 **Mobile → 💻 Desktop**

1. **On Mobile**: Bookmark a restaurant or create a travel story
2. **Auto-sync**: Data uploads to Firebase Firestore
3. **On Desktop**: Changes appear automatically within seconds
4. **Result**: Seamless continuation of your work

#### 💻 **Desktop → 📱 Mobile**

1. **On Desktop**: Update story content or mark location as visited
2. **Auto-sync**: Changes upload immediately when online
3. **On Mobile**: Real-time sync downloads updates
4. **Result**: Always have the latest data on your phone

### **Technical Implementation:**

- **User-Scoped Collections**: Each user's data is isolated (`users/{userId}/features`, `users/{userId}/stories`)
- **Real-time Listeners**: Firebase `onSnapshot` for instant updates
- **Conflict Resolution**: Smart merging and timestamp-based resolution
- **Offline Support**: IndexedDB local storage with sync queue
- **Security**: Firebase Auth + Firestore rules ensure data privacy

## 🚀 Quick Start

This project was created with Svelte's CLI and configured for Cloudflare Pages deployment. Here's how to get started:

### Prerequisites

- Node.js 18+
- npm or pnpm
- Git (for version control)
- Cloudflare account (for deployment)
- Firebase project with Firestore enabled (for cross-device sync)

### Environment Setup

Create a `.env` file with your Firebase configuration for cross-device sync:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

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

## 🔧 Sync Management

### **Check Sync Status**

```typescript
// Check features sync status
const featuresSync = featuresDB.getSyncStatus();
console.log('Features sync:', featuresSync);

// Check stories sync status
const storiesSync = await storiesDB.getSyncStatus();
console.log('Stories sync:', storiesSync);
```

### **Manual Sync (if needed)**

```typescript
// Force full features sync
await featuresDB.forceSyncNow();

// Force full stories sync
await storiesDB.syncWithFirebase();
```

### **Firebase Firestore Security Rules**

Copy these rules to your Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // User's features (bookmarks, visits, todos)
      match /features/{featureId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // User's bookmark lists
      match /lists/{listId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // User's stories
      match /stories/{storyId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // Sync metadata
      match /sync_metadata/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

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

## 🐛 Cross-Device Sync Troubleshooting

### **Sync Not Working**

1. **Check Authentication**: Make sure you're logged into the same account on all devices
2. **Verify Internet Connection**: Sync requires internet connectivity
3. **Check Firebase Configuration**: Ensure environment variables are correct
4. **Force Manual Sync**: Use the manual sync methods if automatic sync fails

### **Data Not Appearing on Other Devices**

1. **Same Account**: Ensure you're logged into the same account on all devices
2. **Wait for Sync**: Real-time sync usually takes 1-3 seconds
3. **Refresh App**: Try refreshing the browser/app
4. **Check Firebase Console**: Verify data is being written to Firestore

### **Testing Cross-Device Sync**

To verify sync is working across your devices:

1. **Login**: Use the same account on multiple devices
2. **Create**: Add a bookmark or create a story on device 1
3. **Verify**: Check that it appears on device 2 within seconds
4. **Edit**: Make changes on device 2
5. **Confirm**: See changes reflected on device 1

## 🔧 Project Structure

```
buzplanet/
├── src/                    # Source code
│   ├── lib/
│   │   ├── stores/         # Data management
│   │   │   ├── FeaturesDB.svelte.ts  # Features with Firestore sync
│   │   │   ├── StoriesDB.svelte.ts   # Stories with Firestore sync
│   │   │   └── auth.ts               # Firebase Authentication
│   │   ├── firebase/       # Firebase integration
│   │   │   └── storiesSync.ts        # Stories sync logic
│   │   └── firebase.ts     # Firebase configuration
├── static/                 # Static assets
├── scripts/               # Build scripts
│   └── bump-version.mjs   # Version management
├── project.inlang/        # Internationalization
├── firestore.rules        # Firebase security rules
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

## 🔐 Privacy & Security

- **User Data Isolation**: Each user's data is completely separate and secure
- **Authentication Required**: All data access requires valid authentication
- **Firebase Security Rules**: Server-side rules enforce data access permissions
- **Local Encryption**: IndexedDB provides secure local storage

## 📱 Device Compatibility

### **Supported Platforms**

- ✅ **Desktop Browsers**: Chrome, Firefox, Safari, Edge
- ✅ **Mobile Browsers**: iOS Safari, Android Chrome
- ✅ **Progressive Web App**: Can be installed on mobile devices

---

**✅ Cross-Device Sync Guarantee**: When you log into the same account on multiple devices, all your bookmarks, visits, stories, and lists will synchronize automatically in real-time. This has been verified and tested across the entire application.\*\*

---

### Development Notes

#### r2 files

wrangler r2 bucket create mbtiles

wrangler r2 object put mbtiles/transportation_asia_japan_kanto.mbtiles \
 --file /home/bmodave/coding/data/mbtiles/transportation_asia_japan_kanto.mbtiles \
 --content-type application/x-sqlite3 \
 --cache-control "public, max-age=31536000, immutable" \
 --remote

#### Worker

https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/

#### To Build

- click on row triggers a sub-drawer with details and map
- Add Stories
