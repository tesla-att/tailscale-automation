#!/bin/bash

# =================================================================
# SCRIPT KIỂM TRA VÀ XÁC MINH UPDATES
# Chạy script này để kiểm tra từng bước đã được thực hiện đúng
# =================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Helper functions
check_start() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -e "${BLUE}🔍 Checking: $1${NC}"
}

check_pass() {
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    echo -e "${GREEN}✅ PASS: $1${NC}"
}

check_fail() {
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    echo -e "${RED}❌ FAIL: $1${NC}"
}

check_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    TAILSCALE SYSTEM VERIFICATION              ║"
echo "║                         Update Checker                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# =================================================================
# 1. CHECK FILE STRUCTURE
# =================================================================

echo -e "\n${BLUE}📁 STEP 1: File Structure Check${NC}"
echo "=============================================="

# Check if main files exist
check_start "api/server.js exists"
if [ -f "api/server.js" ]; then
    check_pass "api/server.js found"
else
    check_fail "api/server.js missing"
fi

check_start "scheduler/scheduler.js exists"
if [ -f "scheduler/scheduler.js" ]; then
    check_pass "scheduler/scheduler.js found"
else
    check_fail "scheduler/scheduler.js missing - CRITICAL"
    echo "  → Run: touch scheduler/scheduler.js"
    echo "  → Then copy content from the guide"
fi

check_start "docker-compose.yml exists"
if [ -f "docker-compose.yml" ]; then
    check_pass "docker-compose.yml found"
else
    check_fail "docker-compose.yml missing"
fi

check_start ".env file exists"
if [ -f ".env" ]; then
    check_pass ".env found"
else
    check_fail ".env missing"
fi

# =================================================================
# 2. CHECK API SERVER REDIS FIX
# =================================================================

echo -e "\n${BLUE}🔧 STEP 2: API Server Redis Configuration${NC}"
echo "=============================================="

check_start "Redis client configuration in api/server.js"
if grep -q "redisClient = redis.createClient" api/server.js; then
    check_pass "Redis client variable name updated"
else
    check_fail "Still using old 'client' variable name"
    echo "  → Need to change 'client' to 'redisClient'"
fi

check_start "Redis socket configuration"
if grep -q "socket:" api/server.js; then
    check_pass "Socket configuration found"
else
    check_fail "Missing socket configuration"
    echo "  → Need to add socket: { host: ..., port: ... }"
fi

check_start "Redis connection error handling"
if grep -q "redisClient.on('connect'" api/server.js; then
    check_pass "Connection event handlers found"
else
    check_fail "Missing connection event handlers"
fi

check_start "Health check endpoint"
if grep -q "/health" api/server.js; then
    check_pass "Health check endpoint found"
else
    check_warning "Health check endpoint missing (optional)"
fi

# =================================================================
# 3. CHECK SCHEDULER FILE CONTENT
# =================================================================

echo -e "\n${BLUE}⏰ STEP 3: Scheduler Configuration${NC}"
echo "=============================================="

if [ -f "scheduler/scheduler.js" ]; then
    check_start "Scheduler imports"
    if grep -q "const redis = require('redis')" scheduler/scheduler.js; then
        check_pass "Required imports found"
    else
        check_fail "Missing required imports"
    fi
    
    check_start "Scheduler Redis configuration"
    if grep -q "socket:" scheduler/scheduler.js; then
        check_pass "Socket configuration in scheduler"
    else
        check_fail "Missing socket configuration in scheduler"
    fi
    
    check_start "Cron jobs setup"
    if grep -q "new cron.CronJob" scheduler/scheduler.js; then
        check_pass "Cron jobs configured"
    else
        check_fail "Missing cron jobs"
    fi
else
    check_fail "scheduler/scheduler.js file missing - cannot check content"
fi

# =================================================================
# 4. CHECK ENVIRONMENT VARIABLES
# =================================================================

echo -e "\n${BLUE}🔐 STEP 4: Environment Variables${NC}"
echo "=============================================="

check_start "REDIS_HOST in .env"
if grep -q "REDIS_HOST=redis" .env; then
    check_pass "REDIS_HOST configured"
else
    check_fail "REDIS_HOST missing or incorrect"
    echo "  → Add: REDIS_HOST=redis"
fi

check_start "REDIS_PORT in .env"
if grep -q "REDIS_PORT=6379" .env; then
    check_pass "REDIS_PORT configured"
else
    check_warning "REDIS_PORT missing (will use default)"
fi

check_start "TAILSCALE_API_KEY in .env"
if grep -q "TAILSCALE_API_KEY=" .env && ! grep -q "TAILSCALE_API_KEY=$" .env; then
    check_pass "TAILSCALE_API_KEY configured"
else
    check_fail "TAILSCALE_API_KEY missing or empty - CRITICAL"
    echo "  → Add your actual Tailscale API key"
fi

check_start "TAILNET in .env"
if grep -q "TAILNET=" .env && ! grep -q "TAILNET=$" .env; then
    check_pass "TAILNET configured"
else
    check_fail "TAILNET missing or empty - CRITICAL"
    echo "  → Add your tailnet name (e.g., company.ts.net)"
fi

# =================================================================
# 5. CHECK DOCKER CONFIGURATION
# =================================================================

echo -e "\n${BLUE}🐳 STEP 5: Docker Configuration${NC}"
echo "=============================================="

check_start "Docker Compose services"
if grep -q "api-server:" docker-compose.yml && grep -q "scheduler:" docker-compose.yml && grep -q "redis:" docker-compose.yml; then
    check_pass "All required services defined"
else
    check_fail "Missing services in docker-compose.yml"
fi

check_start "Package.json files"
if [ -f "api/package.json" ] && [ -f "scheduler/package.json" ]; then
    check_pass "Package.json files exist"
else
    check_fail "Missing package.json files"
fi

# =================================================================
# 6. CHECK SYSTEM CONFIGURATION
# =================================================================

echo -e "\n${BLUE}⚙️  STEP 6: System Configuration${NC}"
echo "=============================================="

check_start "Redis memory overcommit"
if grep -q "vm.overcommit_memory = 1" /etc/sysctl.conf 2>/dev/null; then
    check_pass "Redis memory overcommit configured"
else
    check_warning "Redis memory overcommit not set (may cause warnings)"
    echo "  → Run: echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf"
fi

# =================================================================
# 7. RUNTIME CHECKS (if containers are running)
# =================================================================

echo -e "\n${BLUE}🏃 STEP 7: Runtime Checks${NC}"
echo "=============================================="

check_start "Docker Compose status"
if docker-compose ps >/dev/null 2>&1; then
    RUNNING_CONTAINERS=$(docker-compose ps --services --filter "status=running")
    if echo "$RUNNING_CONTAINERS" | grep -q "api-server"; then
        check_pass "API server container running"
    else
        check_fail "API server container not running"
    fi
    
    if echo "$RUNNING_CONTAINERS" | grep -q "scheduler"; then
        check_pass "Scheduler container running"
    else
        check_fail "Scheduler container not running"
    fi
    
    if echo "$RUNNING_CONTAINERS" | grep -q "redis"; then
        check_pass "Redis container running"
    else
        check_fail "Redis container not running"
    fi
else
    check_warning "Docker Compose not running - start with: docker-compose up -d"
fi

check_start "API Health Check"
API_RESPONSE=$(curl -s http://localhost:3000/health 2>/dev/null)
if echo "$API_RESPONSE" | grep -q '"status":"ok"'; then
    check_pass "API server healthy"
    if echo "$API_RESPONSE" | grep -q '"redis":"connected"'; then
        check_pass "Redis connection working"
    else
        check_fail "Redis connection not working"
    fi
else
    check_warning "API server not responding (may be starting up)"
fi

check_start "Web Interface"
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null)
if [ "$WEB_STATUS" = "200" ]; then
    check_pass "Web interface accessible"
else
    check_warning "Web interface not accessible (HTTP $WEB_STATUS)"
fi

# =================================================================
# 8. FINAL SUMMARY
# =================================================================

echo -e "\n${BLUE}📊 VERIFICATION SUMMARY${NC}"
echo "=============================================="
echo -e "Total Checks: ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL CHECKS PASSED!${NC}"
    echo -e "Your Tailscale automation system is properly configured."
    echo -e "\n${BLUE}Next steps:${NC}"
    echo "1. If containers aren't running: docker-compose up -d"
    echo "2. Access web interface: http://localhost:8080"
    echo "3. Login with admin/admin123"
    echo "4. Start adding employees!"
elif [ $FAILED_CHECKS -le 2 ]; then
    echo -e "\n${YELLOW}⚠️  MINOR ISSUES DETECTED${NC}"
    echo -e "Most checks passed, but there are a few issues to fix."
    echo -e "Review the failed checks above and fix them."
else
    echo -e "\n${RED}❌ MAJOR ISSUES DETECTED${NC}"
    echo -e "Several critical issues found. Please fix them before proceeding."
    echo -e "\n${BLUE}Common fixes:${NC}"
    echo "1. Create missing files"
    echo "2. Update Redis configuration in api/server.js"
    echo "3. Add missing environment variables to .env"
    echo "4. Run: docker-compose build --no-cache && docker-compose up -d"
fi

echo -e "\n${BLUE}🔧 Quick fix commands:${NC}"
echo "• Rebuild containers: docker-compose build --no-cache"
echo "• Restart services: docker-compose restart"
echo "• View logs: docker-compose logs -f"
echo "• Check status: docker-compose ps"

# =================================================================
# 9. GENERATE FIX SCRIPT IF NEEDED
# =================================================================

if [ $FAILED_CHECKS -gt 0 ]; then
    echo -e "\n${BLUE}🛠️  Generating quick fix script...${NC}"
    
    cat > quick_fix.sh << 'EOF'
#!/bin/bash
# Quick fix script generated by verification

echo "🔧 Running quick fixes..."

# Fix Redis memory
if ! grep -q "vm.overcommit_memory = 1" /etc/sysctl.conf 2>/dev/null; then
    echo "Fixing Redis memory overcommit..."
    echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf
    sudo sysctl vm.overcommit_memory=1
fi

# Add missing .env variables
if ! grep -q "REDIS_HOST=" .env; then
    echo "Adding Redis configuration to .env..."
    echo "" >> .env
    echo "# Redis Configuration" >> .env
    echo "REDIS_HOST=redis" >> .env
    echo "REDIS_PORT=6379" >> .env
    echo "REDIS_DB=0" >> .env
fi

# Rebuild and restart
echo "Rebuilding containers..."
docker-compose down
docker-compose build --no-cache
docker-compose up -d

echo "✅ Quick fixes applied. Check status with: docker-compose ps"
EOF

    chmod +x quick_fix.sh
    echo -e "${GREEN}Quick fix script created: ./quick_fix.sh${NC}"
    echo "Run it with: ./quick_fix.sh"
fi

echo -e "\n${BLUE}💡 Need help? Check the detailed guide or run verification again after fixes.${NC}"