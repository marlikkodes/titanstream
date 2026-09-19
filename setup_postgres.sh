#!/bin/bash
# PostgreSQL Setup Script for TitanStream Local Development
# Run with: sudo bash setup_postgres.sh

set -e

echo "🔧 Setting up PostgreSQL for TitanStream local development..."

# Update package list
apt update

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
service postgresql start

# Wait for PostgreSQL to be ready
sleep 5

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE titanstream;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE titanstream TO postgres;
ALTER USER postgres WITH SUPERUSER;
EOF

echo "✅ PostgreSQL setup complete!"
echo "📊 Database: titanstream"
echo "👤 User: postgres"
echo "🔐 Password: postgres"
echo "🌐 Connection: postgresql://postgres:postgres@127.0.0.1:5432/titanstream"