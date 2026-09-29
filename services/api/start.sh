#!/bin/sh
set -e

echo "=== STARTUP DIAGNOSTICS ==="

# Validate required variables (fails fast if missing)
validate_env() {
  name=$1
  val=$(eval echo "\$$name")
  if [ -z "$val" ] || [ -z "$(echo "$val" | tr -d ' ')" ]; then
    echo "FATAL: Required environment variable $name is missing or empty!"
    exit 1
  fi
}

validate_env "DATABASE_URL"
validate_env "JWT_SECRET"
validate_env "JWT_REFRESH_SECRET"
validate_env "TELEGRAM_BOT_TOKEN"
validate_env "TELEGRAM_WEBAPP_URL"
validate_env "ADMIN_SESSION_PEPPER"
validate_env "SUPER_ADMIN_TELEGRAM_IDS"
validate_env "USDT_RECEIVING_ADDRESS"

echo "All required environment variables are present."

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations to ensure schema is up to date
echo "Running database migrations..."
npx prisma migrate deploy

echo "Database migrations completed successfully."

# Run main application
exec node dist/main
