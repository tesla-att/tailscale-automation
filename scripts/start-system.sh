#!/bin/bash

# ATT Tailscale Manager - Quick Start Script
# Sử dụng: ./start-system.sh

set -e

echo "======================================"
echo "  ATT TAILSCALE MANAGER - KHỞI ĐỘNG"
echo "======================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Không tìm thấy docker-compose.yml. Vui lòng chạy script từ thư mục /opt/tailscale-automation"
    exit 1
fi

# Check if .env file exists
if [ ! -f "server/.env" ]; then
    print_warning "Không tìm thấy file .env. Đang copy từ .env.example..."
    cp server/.env.example server/.env
    print_warning "Vui lòng cấu hình file server/.env trước khi tiếp tục"
    exit 1
fi

echo "1. Kiểm tra Docker..."
if ! command -v docker &> /dev/null; then
    print_error "Docker chưa được cài đặt"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    print_error "Docker Compose chưa được cài đặt"
    exit 1
fi
print_status "Docker đã sẵn sàng"

echo
echo "2. Dọn dẹp containers cũ..."
docker compose down --remove-orphans > /dev/null 2>&1 || true
print_status "Đã dọn dẹp containers cũ"

echo
echo "3. Khởi động Database..."
docker compose up -d db
print_status "Database đang khởi động..."

# Wait for database
echo "   Đợi database khởi động (30 giây)..."
sleep 30

echo
echo "4. Chạy database migration..."
if docker compose run --rm api alembic upgrade head; then
    print_status "Migration hoàn thành"
else
    print_error "Migration thất bại"
    exit 1
fi

echo
echo "5. Khởi động API Backend..."
docker compose up -d api
print_status "API đang khởi động..."

# Wait for API
echo "   Đợi API khởi động (15 giây)..."
sleep 15

# Check API health
if curl -s http://localhost:8000/healthz > /dev/null 2>&1; then
    print_status "API đã sẵn sàng"
else
    print_warning "API có thể chưa sẵn sàng hoàn toàn"
fi

echo
echo "6. Khởi động Web Frontend..."
docker compose up -d web
print_status "Frontend đang khởi động..."

# Wait for frontend
sleep 10

echo
echo "7. Kiểm tra trạng thái hệ thống..."
echo "   Containers đang chạy:"
docker compose ps

echo
echo "8. Kiểm tra endpoints..."
API_STATUS="FAILED"
WEB_STATUS="FAILED"

if curl -s http://localhost:8000/healthz > /dev/null 2>&1; then
    API_STATUS="OK"
fi

if curl -s -I http://localhost:3000 > /dev/null 2>&1; then
    WEB_STATUS="OK" 
fi

echo "   - API (http://localhost:8000): $API_STATUS"
echo "   - Web (http://localhost:3000): $WEB_STATUS"
echo "   - API Docs: http://localhost:8000/docs"

echo
if [ "$API_STATUS" = "OK" ] && [ "$WEB_STATUS" = "OK" ]; then
    print_status "Hệ thống đã khởi động thành công!"
    echo
    echo "Truy cập giao diện web tại: http://localhost:3000"
    echo "Tài liệu API tại: http://localhost:8000/docs"
else
    print_warning "Hệ thống đã khởi động nhưng một số services có thể chưa sẵn sàng"
    echo
    echo "Để kiểm tra logs:"
    echo "  docker compose logs api"
    echo "  docker compose logs web" 
    echo "  docker compose logs db"
fi

echo
echo "======================================"
echo "  KHỞI ĐỘNG HOÀN TẤT"
echo "======================================"
