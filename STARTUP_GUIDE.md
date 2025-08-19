# ATT TAILSCALE MANAGEMENT - HƯỚNG DẪN KHỞI ĐỘNG HỆ THỐNG

## TỔNG QUAN HỆ THỐNG

ATT Tailscale Management là hệ thống quản lý Tailscale với giao diện web để tạo, quản lý và tự động xoay vòng auth keys.

### Kiến trúc hệ thống:
- **Backend**: FastAPI (Python) - Port 8000
- **Frontend**: React + Vite - Port 3000  
- **Database**: PostgreSQL 16 - Port 5433
- **Container**: Docker + Docker Compose

## BƯỚC 1: KIỂM TRA TRƯỚC KHI KHỞI ĐỘNG

### 1.1 Kiểm tra Docker
```bash
# Kiểm tra Docker service
sudo systemctl status docker

# Khởi động Docker nếu chưa chạy
sudo systemctl start docker
sudo systemctl enable docker

# Kiểm tra Docker Compose
docker compose version
```

### 1.2 Kiểm tra thư mục dự án
```bash
cd /opt/tailscale-manager
ls -la

# Cấu trúc thư mục cần có:
# ├── docker-compose.yml
# ├── README.md
# ├── server/
# └── web-admin/
```

### 1.3 Kiểm tra cấu hình môi trường
```bash
# Kiểm tra file .env trong server
ls -la /opt/tailscale-manager/server/.env

# Nếu không có, copy từ .env.example
cp /opt/tailscale-manager/server/.env.example /opt/tailscale-manager/server/.env
```

## BƯỚC 2: KHỞI ĐỘNG HỆ THỐNG

### 2.1 Dọn dẹp containers cũ (nếu cần)
```bash
cd /opt/tailscale-manager

# Dừng tất cả containers
docker compose down

# Xóa containers cũ (tùy chọn)
docker compose down --remove-orphans

# Kiểm tra không có containers nào chạy
docker ps -a | grep tailscale-manager
```

### 2.2 Khởi động database trước
```bash
# Khởi động database
docker compose up -d db

# Đợi database khởi động hoàn toàn (30-60 giây)
sleep 30

# Kiểm tra database đã sẵn sàng
docker compose logs db
```

### 2.3 Chạy database migration
```bash
# Chạy migration để tạo/cập nhật schema
docker compose run --rm api alembic upgrade head

# Kiểm tra migration thành công
echo "Migration completed - checking status..."
```

### 2.4 Khởi động backend API
```bash
# Khởi động API server
docker compose up -d api

# Đợi API khởi động
sleep 15

# Kiểm tra API health
curl -f http://localhost:8000/healthz || echo "API chưa sẵn sàng"

# Xem logs API nếu có lỗi
docker compose logs api
```

### 2.5 Khởi động frontend
```bash
# Khởi động web interface
docker compose up -d web

# Đợi frontend khởi động  
sleep 10

# Kiểm tra frontend
curl -f http://localhost:3000 || echo "Frontend chưa sẵn sàng"

# Xem logs frontend nếu có lỗi
docker compose logs web
```

## BƯỚC 3: KIỂM TRA HỆ THỐNG

### 3.1 Kiểm tra tất cả services
```bash
# Kiểm tra trạng thái containers
docker compose ps

# Tất cả services phải ở trạng thái "Up"
# db       Up
# api      Up  
# web      Up
```

### 3.2 Kiểm tra kết nối
```bash
# Test database connection
docker compose exec db psql -U postgres -d tailscale_mgr -c "SELECT version();"

# Test API endpoints
curl http://localhost:8000/healthz
curl http://localhost:8000/docs

# Test frontend
curl -I http://localhost:3000
```

### 3.3 Kiểm tra logs cho errors
```bash
# Xem logs tất cả services
docker compose logs

# Xem logs riêng từng service
docker compose logs db
docker compose logs api  
docker compose logs web

# Theo dõi logs real-time
docker compose logs -f
```

## BƯỚC 4: XÁC NHẬN HOẠT ĐỘNG

### 4.1 Truy cập giao diện
- **API Backend**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Web Admin Interface**: http://localhost:3000

### 4.2 Kiểm tra chức năng cơ bản
1. Truy cập Web Admin (http://localhost:3000)
2. Kiểm tra kết nối Tailscale API
3. Tạo user test
4. Tạo auth key test
5. Kiểm tra danh sách devices

## BƯỚC 5: KHẮC PHỤC SỰ CỐ

### 5.1 Nếu Database không khởi động
```bash
# Kiểm tra logs database
docker compose logs db

# Kiểm tra port conflicts
sudo netstat -tulpn | grep 5433

# Reset database nếu cần
docker compose down -v
docker volume rm tailscale-manager_dbdata
docker compose up -d db
```

### 5.2 Nếu API không khởi động
```bash
# Kiểm tra file .env
cat /opt/tailscale-manager/server/.env

# Kiểm tra logs API chi tiết
docker compose logs api

# Rebuild API container
docker compose build api
docker compose up -d api
```

### 5.3 Nếu Frontend không khởi động
```bash
# Kiểm tra logs frontend
docker compose logs web

# Rebuild frontend container
docker compose build web
docker compose up -d web

# Kiểm tra dependencies
docker compose exec web npm list
```

### 5.4 Reset hoàn toàn hệ thống
```bash
# Dừng và xóa tất cả
docker compose down -v

# Xóa images cũ
docker image rm tailscale-manager-api tailscale-manager-web

# Rebuild và khởi động lại
docker compose build
docker compose up -d
```

## BƯỚC 6: TỰ ĐỘNG HÓA KHỞI ĐỘNG

### 6.1 Tạo systemd service
```bash
sudo nano /etc/systemd/system/tailscale-manager.service
```

Nội dung file:
```ini
[Unit]
Description=ATT Tailscale Manager
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=true
WorkingDirectory=/opt/tailscale-manager
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]  
WantedBy=multi-user.target
```

### 6.2 Kích hoạt auto-start
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable tailscale-manager.service

# Test service
sudo systemctl start tailscale-manager.service
sudo systemctl status tailscale-manager.service
```

## BƯỚC 7: MONITORING VÀ BẢO TRÌ

### 7.1 Script kiểm tra hệ thống
```bash
# Tạo script check health
cat > /opt/tailscale-manager/healthcheck.sh << 'EOF'
#!/bin/bash
echo "=== ATT Tailscale Manager Health Check ==="
echo "Thời gian: $(date)"
echo

echo "1. Docker containers:"
docker compose ps

echo -e "\n2. Health endpoints:"
curl -s http://localhost:8000/healthz && echo " - API: OK" || echo " - API: FAILED"
curl -s -I http://localhost:3000 >/dev/null && echo " - Web: OK" || echo " - Web: FAILED"

echo -e "\n3. Database connection:"
docker compose exec -T db psql -U postgres -d tailscale_mgr -c "SELECT 1;" >/dev/null && echo " - DB: OK" || echo " - DB: FAILED"

echo -e "\n4. Disk usage:"
df -h /var/lib/docker/volumes/tailscale-manager_dbdata/

echo -e "\n=== End Health Check ==="
EOF

chmod +x /opt/tailscale-manager/healthcheck.sh
```

### 7.2 Crontab để kiểm tra định kỳ
```bash
# Thêm vào crontab
(crontab -l; echo "*/5 * * * * /opt/tailscale-manager/healthcheck.sh >> /var/log/tailscale-manager-health.log 2>&1") | crontab -

# Kiểm tra logs
tail -f /var/log/tailscale-manager-health.log
```

## THÔNG TIN BẢO MẬT

### Các file quan trọng cần bảo vệ:
- `/opt/tailscale-manager/server/.env` - Chứa API keys và secrets
- Database volume: `tailscale-manager_dbdata`

### Backup định kỳ:
```bash
# Backup database
docker compose exec db pg_dump -U postgres tailscale_mgr > backup_$(date +%Y%m%d).sql

# Backup cấu hình
cp /opt/tailscale-manager/server/.env /opt/tailscale-manager/server/.env.backup.$(date +%Y%m%d)
```

## TÓM TẮT LỆNH KHỞI ĐỘNG NHANH

```bash
cd /opt/tailscale-manager
docker compose down
docker compose up -d db
sleep 30
docker compose run --rm api alembic upgrade head  
docker compose up -d api
sleep 15
docker compose up -d web
docker compose ps
```

---

**Lưu ý**: Đảm bảo kiểm tra file .env có đầy đủ thông tin cấu hình Tailscale OAuth trước khi khởi động.
