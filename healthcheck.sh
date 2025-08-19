#!/bin/bash

# ATT Tailscale Manager - Health Check Script
# Sử dụng: ./healthcheck.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

echo "========================================"
echo "  ATT TAILSCALE MANAGER - HEALTH CHECK"
echo "========================================"
echo "Thời gian kiểm tra: $(date)"
echo

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Không tìm thấy docker-compose.yml. Chạy script từ /opt/tailscale-manager"
    exit 1
fi

# 1. Docker Containers Status
print_header "1. TRẠNG THÁI CONTAINERS"
container_status=$(docker compose ps --format "table {{.Service}}\t{{.State}}")
echo "$container_status"

# Check individual container status
db_status=$(docker compose ps db --format "{{.State}}" 2>/dev/null)
api_status=$(docker compose ps api --format "{{.State}}" 2>/dev/null)
web_status=$(docker compose ps web --format "{{.State}}" 2>/dev/null)

echo
if [ "$db_status" = "running" ]; then
    print_status "Database: Đang chạy"
else
    print_error "Database: Không chạy ($db_status)"
fi

if [ "$api_status" = "running" ]; then
    print_status "API: Đang chạy"
else
    print_error "API: Không chạy ($api_status)"
fi

if [ "$web_status" = "running" ]; then
    print_status "Web: Đang chạy"
else
    print_error "Web: Không chạy ($web_status)"
fi

# 2. Health Endpoints
echo
print_header "2. KIỂM TRA ENDPOINTS"

# API Health
if curl -s -m 5 http://localhost:8000/healthz > /dev/null 2>&1; then
    print_status "API Health (localhost:8000/healthz): OK"
else
    print_error "API Health (localhost:8000/healthz): FAILED"
fi

# API Docs
if curl -s -m 5 -I http://localhost:8000/docs | head -n 1 | grep -q "200 OK"; then
    print_status "API Docs (localhost:8000/docs): OK"
else
    print_warning "API Docs (localhost:8000/docs): Có thể chưa sẵn sàng"
fi

# Web Frontend
if curl -s -m 5 -I http://localhost:3000 | head -n 1 | grep -q "200 OK"; then
    print_status "Web Frontend (localhost:3000): OK"
else
    print_error "Web Frontend (localhost:3000): FAILED"
fi

# 3. Database Connection
echo
print_header "3. KẾT NỐI DATABASE"
if docker compose exec -T db psql -U postgres -d tailscale_mgr -c "SELECT 1;" > /dev/null 2>&1; then
    print_status "Database connection: OK"
    
    # Check tables
    table_count=$(docker compose exec -T db psql -U postgres -d tailscale_mgr -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' \n')
    if [ "$table_count" -gt 0 ]; then
        print_status "Database tables: $table_count bảng được tìm thấy"
    else
        print_warning "Database tables: Không tìm thấy bảng nào"
    fi
else
    print_error "Database connection: FAILED"
fi

# 4. Disk Usage
echo
print_header "4. SỬ DỤNG DISK"
if [ -d "/var/lib/docker/volumes/tailscale-manager_dbdata" ]; then
    db_volume_size=$(du -sh /var/lib/docker/volumes/tailscale-manager_dbdata 2>/dev/null | cut -f1)
    print_status "Database volume: $db_volume_size"
else
    print_warning "Database volume: Không tìm thấy"
fi

# Docker space usage
docker_space=$(docker system df --format "table {{.Type}}\t{{.Size}}" 2>/dev/null | grep -E "Images|Containers|Volumes" | head -3)
echo "Docker space usage:"
echo "$docker_space"

# 5. Resource Usage
echo
print_header "5. TÀI NGUYÊN HỆ THỐNG"

# Memory usage of containers
echo "Memory usage của containers:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker compose ps -q) 2>/dev/null | head -4

# 6. Recent Logs Check
echo
print_header "6. KIỂM TRA LOGS GẦN ĐÂY"

# Check for errors in logs
api_errors=$(docker compose logs api --since="5m" 2>/dev/null | grep -i error | wc -l)
web_errors=$(docker compose logs web --since="5m" 2>/dev/null | grep -i error | wc -l)
db_errors=$(docker compose logs db --since="5m" 2>/dev/null | grep -i error | wc -l)

if [ "$api_errors" -eq 0 ]; then
    print_status "API Logs: Không có lỗi trong 5 phút qua"
else
    print_warning "API Logs: $api_errors lỗi trong 5 phút qua"
fi

if [ "$web_errors" -eq 0 ]; then
    print_status "Web Logs: Không có lỗi trong 5 phút qua"
else
    print_warning "Web Logs: $web_errors lỗi trong 5 phút qua"
fi

if [ "$db_errors" -eq 0 ]; then
    print_status "DB Logs: Không có lỗi trong 5 phút qua"
else
    print_warning "DB Logs: $db_errors lỗi trong 5 phút qua"
fi

# 7. Configuration Check
echo
print_header "7. KIỂM TRA CẤU HÌNH"

if [ -f "server/.env" ]; then
    print_status "File .env: Tồn tại"
    
    # Check important env vars (without exposing values)
    env_vars=("DATABASE_URL" "TS_OAUTH_CLIENT_ID" "TS_OAUTH_CLIENT_SECRET" "ENCRYPTION_KEY")
    for var in "${env_vars[@]}"; do
        if grep -q "^$var=" "server/.env" && [ "$(grep "^$var=" "server/.env" | cut -d'=' -f2)" != "" ]; then
            print_status "$var: Đã được cấu hình"
        else
            print_warning "$var: Chưa được cấu hình hoặc trống"
        fi
    done
else
    print_error "File .env: Không tồn tại"
fi

# 8. Network Check
echo
print_header "8. KIỂM TRA NETWORK"

# Check if docker network exists
if docker network inspect tailscale-manager_default > /dev/null 2>&1; then
    print_status "Docker network: OK"
else
    print_warning "Docker network: Không tìm thấy network tailscale-manager_default"
fi

# Check port availability
ports=("3000" "8000" "5433")
for port in "${ports[@]}"; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        print_status "Port $port: Đang được sử dụng"
    else
        print_warning "Port $port: Không có service nào đang lắng nghe"
    fi
done

# Summary
echo
print_header "TÓM TẮT"

total_checks=0
passed_checks=0

# Count overall health
if [ "$db_status" = "running" ]; then ((passed_checks++)); fi
if [ "$api_status" = "running" ]; then ((passed_checks++)); fi  
if [ "$web_status" = "running" ]; then ((passed_checks++)); fi
((total_checks+=3))

if curl -s -m 5 http://localhost:8000/healthz > /dev/null 2>&1; then ((passed_checks++)); fi
if curl -s -m 5 -I http://localhost:3000 > /dev/null 2>&1; then ((passed_checks++)); fi
((total_checks+=2))

if docker compose exec -T db psql -U postgres -d tailscale_mgr -c "SELECT 1;" > /dev/null 2>&1; then ((passed_checks++)); fi
((total_checks+=1))

echo "Tổng số kiểm tra: $total_checks"
echo "Đã pass: $passed_checks"
echo "Tỷ lệ: $(( passed_checks * 100 / total_checks ))%"

if [ $passed_checks -eq $total_checks ]; then
    print_status "Hệ thống hoạt động bình thường!"
elif [ $passed_checks -ge $(( total_checks * 80 / 100 )) ]; then
    print_warning "Hệ thống hoạt động tốt nhưng có một số vấn đề nhỏ"
else
    print_error "Hệ thống có nhiều vấn đề cần khắc phục"
fi

echo
echo "========================================"
echo "  HEALTH CHECK HOÀN TẤT"
echo "========================================"
