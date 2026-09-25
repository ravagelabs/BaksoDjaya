# --- Stage 1: Build Frontend ---
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# --- Stage 2: Express Server ---
FROM node:22-alpine AS runner

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ .

# Copy built frontend assets into Express static folder
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "index.js"]