#!/bin/bash
# diagnostic.sh - Advanced system diagnostics

echo "=== ATT Tailscale Manager - Advanced Diagnostics ==="
echo "Diagnostic started: $(date)"
echo

# 1. System Information
echo "=== SYSTEM INFORMATION ==="
echo "OS: $(lsb_release -d | cut -f2)"
echo "Kernel: $(uname -r)"
echo "Uptime: $(uptime | awk '{print $3,$4}' | sed 's/,//')"
echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
echo "Memory: $(free -h | awk '/^Mem:/ {print $3"/"$2" ("int($3/$2*100)"%)"}')"
echo "Disk Usage: $(df -h /opt/tailscale-manager | awk 'NR==2 {print $3"/"$2" ("$5")"}')"
echo

# 2. Docker System Status
echo "=== DOCKER SYSTEM STATUS ==="
echo "Docker Version: $(docker --version)"
echo "Docker Compose Version: $(docker compose version)"
echo "Docker Status: $(systemctl is-active docker)"
echo
docker system df
echo
docker system events --since 1h --until now | tail -10
echo

# 3. Container Status and Health
echo "=== CONTAINER STATUS ==="
docker compose ps
echo
echo "Container Health Details:"
for container in $(docker compose ps --services); do
    echo "--- $container ---"
    docker compose logs --tail=10 $container
    echo
done

# 4. Network Connectivity Tests
echo "=== NETWORK CONNECTIVITY ==="
echo "Local API Test:"
curl -w "Response Time: %{time_total}s\n" -s -o /dev/null http://localhost:8000/healthz && echo "✅ API reachable" || echo "❌ API unreachable"

echo "Local Frontend Test:"
curl -w "Response Time: %{time_total}s\n" -s -o /dev/null http://localhost:3000 && echo "✅ Frontend reachable" || echo "❌ Frontend unreachable"

echo "Tailscale API Test:"
if [ -f "server/.env" ]; then
    source server/.env
    if [ ! -z "$TS_OAUTH_CLIENT_ID" ] && [ ! -z "$TS_OAUTH_CLIENT_SECRET" ]; then
        TOKEN_RESPONSE=$(curl -s -X POST https://api.tailscale.com/api/v2/oauth/token \
            -d "grant_type=client_credentials&scope=devices" \
            -u "$TS_OAUTH_CLIENT_ID:$TS_OAUTH_CLIENT_SECRET")
        
        if echo "$TOKEN_RESPONSE" | grep -q "access_token"; then
            echo "✅ Tailscale API authentication successful"
        else
            echo "❌ Tailscale API authentication failed"
            echo "Response: $TOKEN_RESPONSE"
        fi
    else
        echo "❌ Tailscale credentials not configured"
    fi
else
    echo "❌ Environment file not found"
fi
echo

# 5. Database Connectivity and Health
echo "=== DATABASE STATUS ==="
if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    echo "✅ Database is ready"
    
    # Database size and connections
    echo "Database size:"
    docker compose exec -T db psql -U postgres -d tailscale_mgr -c "
        SELECT pg_size_pretty(pg_database_size('tailscale_mgr')) as size;
    "
    
    echo "Active connections:"
    docker compose exec -T db psql -U postgres -d tailscale_mgr -c "
        SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';
    "
    
    echo "Table sizes:"
    docker compose exec -T db psql -U postgres -d tailscale_mgr -c "
        SELECT schemaname,tablename,pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size 
        FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    "
else
    echo "❌ Database connection failed"
fi
echo

# 6. Resource Usage Analysis
echo "=== RESOURCE USAGE ==="
echo "CPU Usage (last 5 minutes):"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
echo

echo "Memory Usage:"
free -h
echo

echo "Disk I/O:"
iostat -x 1 1 | tail -n +4
echo

# 7. Log Analysis
echo "=== LOG ANALYSIS ==="
echo "Recent errors in API logs:"
docker compose logs api | grep -i error | tail -5
echo

echo "Recent errors in web logs:"
docker compose logs web | grep -i error | tail -5
echo

echo "Database errors:"
docker compose logs db | grep -i error | tail -5
echo

# 8. Security Checks
echo "=== SECURITY CHECKS ==="
echo "Open ports:"
netstat -tulpn | grep LISTEN | grep -E ':(3000|8000|5433)'
echo

echo "File permissions:"
ls -la server/.env 2>/dev/null && echo "✅ .env file exists" || echo "❌ .env file missing"
echo

# 9. Configuration Validation
echo "=== CONFIGURATION VALIDATION ==="
if [ -f "server/.env" ]; then
    echo "Environment variables check:"
    source server/.env
    
    [ ! -z "$DATABASE_URL" ] && echo "✅ DATABASE_URL set" || echo "❌ DATABASE_URL missing"
    [ ! -z "$TS_OAUTH_CLIENT_ID" ] && echo "✅ TS_OAUTH_CLIENT_ID set" || echo "❌ TS_OAUTH_CLIENT_ID missing"
    [ ! -z "$TS_OAUTH_CLIENT_SECRET" ] && echo "✅ TS_OAUTH_CLIENT_SECRET set" || echo "❌ TS_OAUTH_CLIENT_SECRET missing"
    [ ! -z "$ENCRYPTION_KEY" ] && echo "✅ ENCRYPTION_KEY set" || echo "❌ ENCRYPTION_KEY missing"
else
    echo "❌ .env file not found"
fi
echo

# 10. Performance Metrics
echo "=== PERFORMANCE METRICS ==="
echo "API Response Times (last 10 requests):"
for i in {1..10}; do
    curl -w "%{time_total}s " -s -o /dev/null http://localhost:8000/healthz
done
echo
echo

echo "=== DIAGNOSTIC COMPLETED ==="
echo "Generated at: $(date)"
echo "For support, please share this diagnostic output."