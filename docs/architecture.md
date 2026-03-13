# VendorCenter Architecture

## Overview
VendorCenter is a multi-portal marketplace:
- Customer web app: service discovery and booking
- Vendor portal: onboarding, profile, services, bookings
- Company portal: admin operations and analytics

## Runtime Topology
- Frontend (Vercel): serves customer/vendor/admin SPAs
- Backend (Railway): Express API service
- PostgreSQL: transactional data store
- Supabase Storage: media uploads

## Core Flows
1. Authentication and OTP verification
2. Vendor onboarding and profile completion
3. Geo-aware discovery and category ranking
4. Booking lifecycle and completion flow
5. Notification/email queue processing

## Backend Modules
- auth, otp, vendors, services, bookings, payments
- notifications, analytics, reviews, zones, location
- admin, employee, uploads, activity

## Data and Reliability
- Zod validation at route boundaries
- Role-based route guards
- Rate limiting and security headers
- Health/status endpoints for deployment monitoring
