# Backend

Planned app: Modular API for auth, OTP, zones, vendors, bookings, payments, notifications, analytics.

Recommended stack:
- Node.js + TypeScript
- PostgreSQL + Redis
- Queue worker for email/notifications/activity and analytics pipelines

## Current Implementation
- JWT-based auth with role-protected APIs
- Persistent PostgreSQL storage for users, sessions, OTP events, activity logs, bookings, and zones
- OTP rules: 6-digit, 5-minute expiry, single-use, limited attempts

## Auth Endpoints
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout

## Core Domain Endpoints
- POST /api/otp/request
- POST /api/otp/verify
- GET/POST /api/zones
- POST/PATCH/GET /api/bookings
- GET /api/payments/transactions
- POST/GET /api/vendors/onboarding and /api/vendors
- POST/GET /api/services

## Notes
- Protected endpoints require Authorization: Bearer <accessToken>
- Database schema is initialized from src/db/schema.sql at backend startup
