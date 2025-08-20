#!/bin/bash
# disaster-recovery.sh - Complete system recovery

set -e

BACKUP_DIR="/opt/tailscale-manager/backups"
RECOVERY_DATE="$1"

if [ -z "$RECOVERY_DATE" ]; then
    echo "Usage: $0 <backup_date> (format: YYYYMMDD_HHMMSS)"
    echo "Available backups:"
    ls -la $BACKUP_DIR/database/ | grep "\.dump$" | awk '{print $9}' | sed 's/db_//g' | sed 's/\.dump//g'
    exit 1
fi

echo "=== ATT Tailscale Manager - Disaster Recovery ==="
echo "Recovering from backup: $RECOVERY_DATE"
echo "WARNING: This will overwrite current system!"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# 1. Stop all services
echo "Stopping services..."
docker compose down

# 2. Verify backup files exist
DB_BACKUP="$BACKUP_DIR/database/db_$RECOVERY_DATE.dump"
CONFIG_BACKUP="$BACKUP_DIR/config/env_$RECOVERY_DATE.backup"

if [ ! -f "$DB_BACKUP" ]; then
    echo "❌ Database backup not found: $DB_BACKUP"
    exit 1
fi

if [ ! -f "$CONFIG_BACKUP" ]; then
    echo "❌ Config backup not found: $CONFIG_BACKUP"
    exit 1
fi

# 3. Restore configuration
echo "Restoring configuration..."
cp "$CONFIG_BACKUP" server/.env

# 4. Start database
echo "Starting database..."
docker compose up -d db
sleep 30

# 5. Restore database
echo "Restoring database..."
docker compose exec -T db dropdb -U postgres tailscale_mgr --if-exists
docker compose exec -T db createdb -U postgres tailscale_mgr
docker compose exec -T db pg_restore -U postgres -d tailscale_mgr < "$DB_BACKUP"

# 6. Start all services
echo "Starting all services..."
docker compose up -d

# 7. Verify recovery
echo "Verifying recovery..."
sleep 30

# Check API health
if curl -f http://localhost:8000/healthz >/dev/null 2>&1; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed"
    exit 1
fi

# Check frontend
if curl -f http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ Frontend health check passed"
else
    echo "❌ Frontend health check failed"
    exit 1
fi

# 8. Generate recovery report
cat > "recovery_report_$(date +%Y%m%d_%H%M%S).txt" << EOF
=== Recovery Report ===
Recovery completed: $(date)
Backup source: $RECOVERY_DATE
Database: ✅ Restored
Configuration: ✅ Restored
Services: ✅ Running
API Health: ✅ Healthy
Frontend: ✅ Healthy

Recovery successful!
EOF

echo "=== Recovery completed successfully ==="
cat "recovery_report_$(date +%Y%m%d_%H%M%S).txt"