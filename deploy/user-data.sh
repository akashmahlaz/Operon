#!/bin/bash
set -ex

# Update system
apt-get update && apt-get upgrade -y

# Install essentials
apt-get install -y build-essential pkg-config libssl-dev git curl nginx certbot python3-certbot-nginx unzip postgresql postgresql-contrib

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source /root/.cargo/env
echo 'source /root/.cargo/env' >> /root/.bashrc

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Install bun
curl -fsSL https://bun.sh/install | bash
echo 'export BUN_INSTALL="/root/.bun"' >> /root/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /root/.bashrc
export BUN_INSTALL="/root/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Setup PostgreSQL
sudo -u postgres psql -c "CREATE USER operon WITH PASSWORD 'operon_secure_2026';"
sudo -u postgres psql -c "CREATE DATABASE operon OWNER operon;"
sudo -u postgres psql -c "ALTER USER operon CREATEDB;"

# Enable pgvector
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS vector;" -d operon 2>/dev/null || true

# Clone the repo (will need to be done manually with credentials)
mkdir -p /opt/operon
cd /opt/operon

# Create environment file for backend
cat > /opt/operon/server/.env.production << 'EOF'
DATABASE_URL=postgres://operon:operon_secure_2026@localhost:5432/operon
HOST=0.0.0.0
PORT=8080
RUST_LOG=info
JWT_SECRET=matterfull-jwt-secret-change-in-prod-2026
CORS_ORIGINS=http://localhost:3000,https://localhost
EOF

# Create environment file for frontend
cat > /opt/operon/.env.production << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=matterfull-nextauth-secret-change-in-prod-2026
MONGODB_URI=mongodb://localhost:27017/operon
EOF

# Configure Nginx
cat > /etc/nginx/sites-available/operon << 'NGINX'
server {
    listen 80;
    server_name _;

    # Frontend (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API (Rust/Axum)
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # SSE streaming endpoint
    location /api/agent/ {
        proxy_pass http://127.0.0.1:8080/api/agent/;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
        chunked_transfer_encoding on;
    }

    # File uploads
    client_max_body_size 50M;
}
NGINX

ln -sf /etc/nginx/sites-available/operon /etc/nginx/sites-enabled/operon
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Create systemd service for backend
cat > /etc/systemd/system/operon-backend.service << 'SERVICE'
[Unit]
Description=Operon Backend (Rust/Axum)
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/operon/server
EnvironmentFile=/opt/operon/server/.env.production
ExecStart=/root/.cargo/bin/cargo run --release
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

# Create systemd service for frontend
cat > /etc/systemd/system/operon-frontend.service << 'SERVICE'
[Unit]
Description=Operon Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/operon
Environment=NODE_ENV=production
EnvironmentFile=/opt/operon/.env.production
ExecStart=/root/.bun/bin/bun run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload

echo "=== SETUP COMPLETE ==="
echo "Next steps:"
echo "1. Clone your repo to /opt/operon"
echo "2. Build backend: cd /opt/operon/server && cargo build --release"
echo "3. Build frontend: cd /opt/operon && bun install && bun run build"
echo "4. Start services: systemctl start operon-backend operon-frontend"
