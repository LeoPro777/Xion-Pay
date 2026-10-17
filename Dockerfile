# ==========================================
# Stage 1: Build Frontend (Vite + React)
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Unified Runtime (Python + Nginx)
# ==========================================
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    PORT=10000

WORKDIR /app

# Install system dependencies: Nginx, gettext-base (for envsubst), PostgreSQL client libraries, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    gettext-base \
    libpq-dev \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application and maintenance scripts
COPY backend/ ./backend/
COPY scripts/ ./scripts/

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist /var/www/frontend

# Copy Nginx template and container entrypoint
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/entrypoint.sh /app/entrypoint.sh

# Normalize CRLF line endings (safety for Windows hosts) and set executable permissions
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Create certs mount directory
RUN mkdir -p /app/certs /app/backend/certs

EXPOSE 10000

ENTRYPOINT ["/app/entrypoint.sh"]
