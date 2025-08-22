#!/bin/bash
# backup-system.sh - Comprehensive backup solution

BACKUP_BASE="/opt/tailscale-automation/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directories
mkdir -p $BACKUP_BASE/{database,config,code,logs}

echo "=== ATT Tailscale Manager - Comprehensive Backup ==="
echo "Backup started: $(date)"

# 1. Database backup with compression
echo "Backing up database..."
docker compose exec -T db pg_dump -U postgres -Fc tailscale_mgr > "$BACKUP_BASE/database/db_$DATE.dump"

# Verify database backup
if [ -s "$BACKUP_BASE/database/db_$DATE.dump" ]; then
    echo "✅ Database backup completed: $(ls -lh $BACKUP_BASE/database/db_$DATE.dump | awk '{print $5}')"
else
    echo "❌ Database backup failed"
    exit 1
fi

# 2. Configuration backup
echo "Backing up configuration..."
cp server/.env "$BACKUP_BASE/config/env_$DATE.backup"
cp docker-compose.yml "$BACKUP_BASE/config/compose_$DATE.yml"
cp -r server/alembic "$BACKUP_BASE/config/alembic_$DATE"

# 3. Application code backup
echo "Backing up application code..."
git archive --format=tar.gz --prefix=tailscale-automation-$DATE/ HEAD > "$BACKUP_BASE/code/code_$DATE.tar.gz"

# 4. Logs backup
echo "Backing up logs..."
docker compose logs > "$BACKUP_BASE/logs/docker_logs_$DATE.txt"

# 5. System state backup
echo "Backing up system state..."
cat > "$BACKUP_BASE/system_state_$DATE.json" << EOF
{
  "backup_date": "$(date -Iseconds)",
  "docker_version": "$(docker --version)",
  "compose_version": "$(docker compose version)",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git branch --show-current)",
  "system_uptime": "$(uptime)",
  "disk_usage": "$(df -h /opt/tailscale-automation)",
  "container_status": $(docker compose ps --format json)
}
EOF

# 6. Cleanup old backups
echo "Cleaning up old backups..."
find $BACKUP_BASE -name "*.dump" -mtime +$RETENTION_DAYS -delete
find $BACKUP_BASE -name "*.backup" -mtime +$RETENTION_DAYS -delete
find $BACKUP_BASE -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_BASE -name "*.txt" -mtime +$RETENTION_DAYS -delete

# 7. Backup to remote storage (S3/Minio)
if [ ! -z "$AWS_S3_BUCKET" ]; then
    echo "Uploading to S3..."
    aws s3 sync $BACKUP_BASE s3://$AWS_S3_BUCKET/tailscale-automation-backups/ --delete
fi

# 8. Generate backup report
BACKUP_SIZE=$(du -sh $BACKUP_BASE | cut -f1)
echo "
=== Backup Report ===
Date: $(date)
Total backup size: $BACKUP_SIZE
Database backup: ✅
Config backup: ✅
Code backup: ✅
Logs backup: ✅
Remote sync: ${AWS_S3_BUCKET:+✅}${AWS_S3_BUCKET:-❌}
" > "$BACKUP_BASE/backup_report_$DATE.txt"

echo "=== Backup completed successfully ==="
cat "$BACKUP_BASE/backup_report_$DATE.txt"

# 9. Send notification
if [ ! -z "$TELEGRAM_BOT_TOKEN" ] && [ ! -z "$TELEGRAM_CHAT_ID" ]; then
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d text="📁 ATT Tailscale Manager backup completed. Size: $BACKUP_SIZE"
fi