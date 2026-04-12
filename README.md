# VendorCenter

VendorCenter is a multi-portal local services marketplace with separate customer, vendor, and company/admin experiences — plus native Android apps for both customers and vendors.

The platform combines a React frontend, an Express + PostgreSQL backend, Flutter mobile apps, and a hybrid retrieval-assisted AI assistant for service discovery, booking guidance, and FAQ support.

## What Ships

- Customer portal (web + Android app) for service discovery, booking, payments, reviews, and account history
- Vendor portal (web + Android app) for onboarding, service management, and booking operations
- Company/admin portal for vendor approvals, analytics, zone management, and oversight
- AI assistant with semantic search, tool dispatch, and LLM fallback
- Firebase Crashlytics for crash reporting across both mobile apps
- Firebase Analytics for usage tracking
- Install tracking with admin dashboard

## Architecture At A Glance

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind, Radix UI |
| Mobile | Flutter 3.41, Dart 3.11, Firebase, Material 3 |
| Backend | Node.js, Express, TypeScript, Zod |
| Database | PostgreSQL + pgvector |
| AI | Qwen2.5-3B GGUF, Groq, Gemini, semantic search |
| Crash/Analytics | Firebase Crashlytics, Firebase Analytics |
| Deployment | Vercel (frontend), Railway (backend), Hugging Face Space (self-hosted model) |

## Repository Layout

```text
vendorcenter/
├── backend/        # Express API, DB bootstrap, workers, feature modules
├── frontend/       # Vite multi-entry app for customer, vendor, and company portals
├── mobile/         # Flutter apps — customer and vendor flavors
│   ├── lib/
│   │   ├── config/      # API config, routing, theming
│   │   ├── i18n/        # Translations (EN, MR, HI)
│   │   ├── screens/     # 18 feature directories, 34 screens
│   │   ├── services/    # API, auth, favorites, location, notifications, updates
│   │   └── widgets/     # Reusable UI components
│   └── android/         # Gradle config, flavors, Firebase config
├── deploy/         # Production runbooks, preflight scripts, hosting helpers
├── docs/           # Architecture, AI docs, scope docs, reports
├── infra/          # Docker and local infrastructure files
├── model/          # HF Space runtime, notebooks, training data, model scripts
├── .github/
├── AGENTS.md
├── package.json
└── README.md
```

## Local Development
dockerfile and local infrastructure scripts are available for development, but the stack can be run with minimal setup using the commands below. The project is optimized for fast iteration and low-friction local development, so you can focus on outcomes without getting bogged down in configuration.

### Prerequisites

- Node.js 20+
- npm 10+
- Flutter 3.41+ and Dart 3.11+ (for mobile development)
- Android SDK (API 35) with Java 17
- PostgreSQL with `pgvector` available for the full AI feature set
- Local `.env` configured with database, JWT, SMTP, and AI provider values
- Firebase project configured (for mobile auth, push notifications, Crashlytics)

### Install

```bash
npm install
```

### Run

Start the backend and frontend in separate terminals from the repo root:

```bash
npm run dev:backend
npm run dev:frontend
```

Local URLs:

- Customer portal: `http://localhost:3000/`
- Vendor portal: `http://localhost:3000/vendor`
- Company portal: `http://localhost:3000/company`
- Backend API: `http://localhost:4000/`

The frontend dev server is a single Vite app that serves all three portal entry points.

## Mobile Development

### Flavors

The Flutter app has two flavors:

| Flavor | Package | Entry Point | App Name |
|---|---|---|---|
| Customer | `com.vendorcenter.customer` | `lib/main.dart` | VendorCenter |
| Vendor | `com.vendorcenter.vendor` | `lib/vendor_main.dart` | VendorPortal |

### Run (Debug)

```bash
cd mobile
flutter run --flavor customer -t lib/main.dart
flutter run --flavor vendor -t lib/vendor_main.dart
```

### Build Release APKs

```bash
cd mobile
flutter build apk --release --flavor customer -t lib/main.dart
flutter build apk --release --flavor vendor -t lib/vendor_main.dart
```

Output:
- `mobile/build/app/outputs/apk/customer/release/app-customer-release.apk`
- `mobile/build/app/outputs/apk/vendor/release/app-vendor-release.apk`

### APK Distribution

Self-hosted distribution via GitHub Releases. The backend `GET /api/version` endpoint returns current version and APK download URLs. Mobile apps check this on launch via `UpdateService` and prompt users to update.

APK URLs are configurable via environment variables:
- `CUSTOMER_APK_URL` — customer APK download link
- `VENDOR_APK_URL` — vendor APK download link
- `APP_CURRENT_VERSION` — current app version (checked against installed)
- `APP_FORCE_UPDATE` — set to `true` to force update

### Firebase Integration

| Feature | Package | Status |
|---|---|---|
| Authentication | `firebase_auth` | Phone OTP + Email |
| Crashlytics | `firebase_crashlytics` | Crash reporting (release builds) |
| Analytics | `firebase_analytics` | Usage tracking (release builds) |
| Cloud Messaging | `firebase_messaging` | Push notifications |
| App Check | `firebase_app_check` | Play Integrity verification |

### Install Tracking

On first launch, the app reports device info, version, and flavor to `POST /api/analytics/install`. Admin dashboard at `/analytics` shows install counts, daily trends, and device breakdown.

## Common Commands

| Command | Purpose |
|---|---|
| `npm run dev:backend` | Start backend on port `4000` |
| `npm run dev:frontend` | Start frontend on port `3000` |
| `npm run build` | Build backend and frontend |
| `npm run db:bootstrap` | Bootstrap database schema and seed core data |
| `npm run db:health` | Run database health check |
| `npm run db:seed-admin` | Seed admin user; requires `ADMIN_PASSWORD` |

## AI Assistant

VendorCenter uses a hybrid retrieval-assisted assistant, not a full classic document RAG pipeline.

Current AI flow includes:

- `pgvector` semantic FAQ and category matching
- Semantic vendor search with geo filtering
- LLM provider chain: self-hosted Qwen2.5-3B GGUF -> Groq -> Gemini fallback
- Deterministic handling for common chat/control prompts
- Query logging and confidence-based routing

Language support is intentionally described conservatively:

- English is the strongest language for the fine-tuned model
- Hindi and Hinglish are reasonably supported for marketplace queries
- Marathi support is reliable for VendorCenter workflows, but it is significantly reinforced by backend keyword mapping, deterministic handling, and provider fallback logic

## Database

- Core schema: `backend/src/db/schema.sql`
- Embedding tables include service category and FAQ vectors
- The app uses PostgreSQL as the primary database and `pgvector` for semantic search

## Deployment

- Frontend deployment root: `frontend/`
- Backend deployment root: `backend/`
- Model-serving Space files: `model/hf-space/`
- Production scripts and runbooks: `deploy/`

Current deployment targets:

- Vercel for frontend (vendorcenter.in)
- Railway for backend (vendorcenter-production.up.railway.app)
- Hugging Face Space for the self-hosted GGUF model
- GitHub Releases for APK distribution
- Firebase for auth, Crashlytics, analytics, push notifications

## Security Notes

- Production startup blocks insecure default JWT secrets
- Input sanitization is enabled server-side (XSS middleware on all routes)
- API routes are rate-limited and validated with Zod
- Upload handling includes validation and error sanitization
- Phone OTP billing protection: platform-wide 9/day + per-phone 3/day limits
- Firebase App Check with Play Integrity for API abuse prevention
- Role enforcement on all auth endpoints — cross-role login blocked
- Secrets are expected in local or deployment environment files, not in git-tracked files

## Documentation

- Architecture: `docs/architecture.md`
- AI notes: `docs/ai-features.md`
- AI roadmap: `docs/AI_PLAN.md`
- Project scope: `docs/PROJECT_SCOPE.md`
- Project scope PDF: `docs/Project_Scope_VendorCenter.pdf`
- Module docs: `docs/modules/`
- Reports: `docs/reports/`

## Notes

- `model/` contains notebooks, training data, Hugging Face runtime assets, and model scripts
- `deploy/` contains deployment helpers and operational runbooks
- Keep local secrets and private planning artifacts out of commits
