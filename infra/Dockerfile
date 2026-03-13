# Reference Dockerfile kept under infra/ for company-grade repository layout.
# Deployment compatibility note:
# - Railway currently deploys backend from backend/
# - Vercel currently deploys frontend from frontend/

FROM node:20-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx tsc -p tsconfig.json

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads
EXPOSE 4000
CMD ["node", "dist/server.js"]
