#!/bin/bash
set -e

PORT="${PORT:-10000}"
export PORT

echo "========================================================"
echo " Starting Xion-Pay Container (Render Deployment)"
echo " Listening on PORT: ${PORT}"
echo "========================================================"

# 1. Clean default Nginx site configurations
rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf 2>/dev/null || true

# 2. Render Nginx configuration with dynamic PORT
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/xionpay.conf

# 3. Ensure RSA cryptographic licensing keys are present
mkdir -p /app/certs
if [ ! -f /app/certs/license_private.pem ] || [ ! -f /app/certs/license_public.pem ]; then
    echo "[!] RSA keys not detected. Generating keypair in /app/certs..."
    python /app/scripts/generate_keys.py
fi

# Ensure backend directory has access to certs
mkdir -p /app/backend/certs
cp -n /app/certs/*.pem /app/backend/certs/ 2>/dev/null || true

# 4. Initialize / seed database (idempotent)
export PYTHONPATH=/app/backend
echo "[*] Synchronizing database tables and default seed data..."
python /app/backend/scripts/seed.py || echo "[WARN] Seed step completed with warnings or external DB not yet reachable, continuing."

# 5. Start Backend Service (FastAPI / Uvicorn)
echo "[*] Starting Uvicorn backend process on 127.0.0.1:8000..."
cd /app/backend
uvicorn src.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# 6. Start Frontend / Reverse Proxy Service (Nginx)
echo "[*] Starting Nginx reverse proxy on 0.0.0.0:${PORT}..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Graceful termination handler
cleanup() {
    echo "[*] Termination signal received. Stopping services gracefully..."
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
    kill -TERM "$NGINX_PID" 2>/dev/null || true
    wait "$BACKEND_PID" "$NGINX_PID" 2>/dev/null || true
    echo "[OK] Services stopped."
    exit 0
}

trap cleanup SIGTERM SIGINT

# Keep container running and monitor child processes
wait -n "$BACKEND_PID" "$NGINX_PID"
