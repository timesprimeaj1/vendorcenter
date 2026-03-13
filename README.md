# VendorCenter

VendorCenter is a location-based services marketplace with separate customer, vendor, and company/admin experiences.

## Repository Layout

vendorcenter/
- backend/
	- src/
	- config/
	- package.json
	- tsconfig.json
- frontend/
	- src/
	- public/
	- index.html
	- vite.config.ts
	- package.json
- docs/
	- architecture.md
	- ai-features.md
	- AI_PLAN.md
	- modules/
- infra/
	- docker-compose.yml
	- Dockerfile
- .gitignore
- README.md

## Deployment Safety

- Frontend deployment remains from frontend/ (Vercel setup unchanged).
- Backend deployment remains from backend/ (Railway setup unchanged).
- Environment variable usage is unchanged.

## Run Locally

From repo root:
- npm run dev:backend
- npm run dev:frontend

Build:
- npm run build

## Database

- PostgreSQL schema bootstrap file: backend/src/db/schema.sql
- Health check: npm run db:health

## Operations Docs

- Production scripts and runbooks remain in deploy/
- Architecture notes: docs/architecture.md
- AI roadmap: docs/ai-features.md and docs/AI_PLAN.md
