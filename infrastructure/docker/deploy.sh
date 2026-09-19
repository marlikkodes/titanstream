#!/usr/bin/env bash
# TitanStream VPS Deploy Script
# Run on a fresh Ubuntu 22.04+ VPS after cloning the repo
#
# Usage:
#   1. Clone repo on VPS
#   2. Copy .env.example to .env and fill in values
#   3. chmod +x deploy.sh && ./deploy.sh

set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  TitanStream Production Deploy"
echo "═══════════════════════════════════════════════"

# ── Check .env exists ────────────────────────────────────────
if [ ! -f .env ]; then
    echo "❌ No .env file found. Copy .env.example to .env and fill it in."
    echo "   cp infrastructure/docker/.env.example .env"
    exit 1
fi

# ── Install Docker if missing ────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "✅ Docker installed. You may need to log out and back in."
fi

# ── Install Docker Compose plugin if missing ─────────────────
if ! docker compose version &> /dev/null; then
    echo "📦 Installing Docker Compose plugin..."
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi

# ── Configure UFW firewall ───────────────────────────────────
if command -v ufw &> /dev/null; then
    echo "🔒 Configuring firewall..."
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
    echo "✅ Firewall configured (SSH + HTTP/HTTPS only)"
fi

# ── Build and start ─────────────────────────────────────────
echo "🐳 Building and starting containers..."
cd infrastructure/docker
docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Deployed! Check status:"
echo "  docker compose -f infrastructure/docker/docker-compose.yml ps"
echo "  docker compose -f infrastructure/docker/docker-compose.yml logs -f"
echo "═══════════════════════════════════════════════"
