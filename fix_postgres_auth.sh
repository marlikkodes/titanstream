#!/bin/bash
# Fix PostgreSQL authentication for TitanStream local development
# Run with: sudo bash fix_postgres_auth.sh

set -e

echo "🔧 Fixing PostgreSQL authentication for TitanStream..."

# Reset postgres user password
sudo -u postgres psql <<EOF
ALTER USER postgres WITH PASSWORD 'postgres';
EOF

# Update pg_hba.conf to use md5 authentication
PG_HBA="/etc/postgresql/*/main/pg_hba.conf"
sudo sed -i 's/scram-sha-256/md5/g' $PG_HBA
sudo sed -i 's/peer/md5/g' $PG_HBA

# Reload PostgreSQL configuration
sudo service postgresql reload

echo "✅ PostgreSQL authentication fixed!"
echo "📊 User: postgres"
echo "🔐 Password: postgres"
echo "🌐 Connection: postgresql://postgres:postgres@127.0.0.1:5432/titanstream"