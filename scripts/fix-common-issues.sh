#!/bin/bash
# fix-common-issues.sh - Automated fixes for common problems

echo "=== ATT Tailscale Manager - Common Issue Fixes ==="

# Function to fix database connection issues
fix_database() {
    echo "🔧 Fixing database connection issues..."
    
    # Stop services
    docker compose down
    
    # Remove old volumes if corrupted
    read -p "Remove database volume? This will delete all data! (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume rm tailscale-manager_dbdata
    fi
    
    # Restart database
    docker compose up -d db
    sleep 30
    
    # Run migrations
    docker compose run --rm api alembic upgrade head
    
    echo "✅ Database fix completed"
}

# Function to fix API issues
fix_api() {
    echo "🔧 Fixing API issues..."
    
    # Rebuild API container
    docker compose build api
    docker compose up -d api
    
    # Wait for health check
    echo "Waiting for API to be healthy..."
    for i in {1..30}; do
        if curl -f http://localhost:8000/healthz >/dev/null 2>&1; then
            echo "✅ API is now healthy"
            return 0
        fi
        sleep 2
    done
    
    echo "❌ API still not healthy, check logs:"
    docker compose logs api --tail=20
}

# Function to fix frontend issues
fix_frontend() {
    echo "🔧 Fixing frontend issues..."
    
    # Clear node modules and reinstall
    cd web-admin
    rm -rf node_modules package-lock.json
    npm install
    cd ..
    
    # Rebuild frontend container
    docker compose build web
    docker compose up -d web
    
    echo "✅ Frontend fix completed"
}

# Function to fix permissions
fix_permissions() {
    echo "🔧 Fixing file permissions..."
    
    # Fix .env file permissions
    chmod 600 server/.env
    
    # Fix log directory permissions
    mkdir -p logs
    chmod 755 logs
    
    # Fix backup directory permissions
    mkdir -p backups
    chmod 755 backups
    
    echo "✅ Permissions fixed"
}

# Function to fix disk space
fix_disk_space() {
    echo "🔧 Cleaning up disk space..."
    
    # Clean Docker system
    docker system prune -f
    docker image prune -f
    docker volume prune -f
    
    # Clean old logs
    find logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # Clean old backups
    find backups -mtime +30 -delete 2>/dev/null || true
    
    echo "✅ Disk cleanup completed"
}

# Main menu
echo "Select issue to fix:"
echo "1. Database connection issues"
echo "2. API not responding"
echo "3. Frontend not loading"
echo "4. File permission issues"
echo "5. Disk space issues"
echo "6. Complete system reset"
echo "7. Exit"

read -p "Enter option (1-7): " option

case $option in
    1) fix_database ;;
    2) fix_api ;;
    3) fix_frontend ;;
    4) fix_permissions ;;
    5) fix_disk_space ;;
    6) 
        echo "⚠️  WARNING: This will reset the entire system!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker compose down -v
            docker system prune -af
            docker compose up -d db
            sleep 30
            docker compose run --rm api alembic upgrade head
            docker compose up -d
            echo "✅ Complete system reset completed"
        fi
        ;;
    7) echo "Exiting..." ;;
    *) echo "Invalid option" ;;
esac