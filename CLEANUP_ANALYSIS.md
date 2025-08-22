# Project Cleanup Analysis

## Files và Directories có thể xóa an toàn

### 1. **Test Files (Có thể xóa)**
- `test_tailscale.py` - Test script cho Tailscale API, không cần thiết cho production
- `server/test_db_connection.py` - Test database connection, chỉ dùng để debug
- `Note.txt` - Ghi chú tạm thời, không cần thiết

### 2. **Backup Files (Có thể xóa)**
- `backup_20250820_123628.sql` - File backup rỗng (0 bytes), không có dữ liệu

### 3. **Build Artifacts (Có thể xóa)**
- `web-admin/dist/` - Build output, có thể regenerate
- `web-admin/node_modules/` - Dependencies, có thể reinstall
- `web-admin/tsconfig.app.tsbuildinfo` - TypeScript build cache
- `web-admin/package-lock.json` - Lock file, có thể regenerate

### 4. **Scripts không cần thiết (Cần review)**
- `web-admin/fix-realtime-counts.sh` - Script fix tạm thời
- `web-admin/test-error-handling.sh` - Test script
- `web-admin/test-frontend-api.sh` - Test script
- `web-admin/restart-and-test.sh` - Test script
- `web-admin/test-api-endpoints.sh` - Test script

### 5. **Documentation Files trùng lặp (Cần review)**
- `web-admin/FINAL_REALTIME_FIX_README.md`
- `web-admin/REALTIME_COUNTS_FIX_README.md`
- `web-admin/TAB_PANEL_FIX_README.md`

## Files và Directories cần giữ lại

### 1. **Core Application Files**
- `server/app/` - Backend application code
- `server/requirements.txt` - Python dependencies
- `server/Dockerfile` - Backend container config
- `server/alembic/` - Database migrations

### 2. **Frontend Source Code**
- `web-admin/src/` - React source code
- `web-admin/package.json` - Frontend dependencies
- `web-admin/vite.config.ts` - Build configuration
- `web-admin/tailwind.config.js` - CSS framework config

### 3. **Configuration Files**
- `docker-compose.yml` - Container orchestration
- `.gitignore` - Git ignore rules
- `README.md` - Project documentation

### 4. **Essential Scripts**
- `start-system.sh` - System startup script
- `healthcheck.sh` - Health monitoring
- `scripts/backup-system.sh` - Backup functionality

## Kế hoạch dọn dẹp

### Phase 1: Xóa Test Files
```bash
rm test_tailscale.py
rm server/test_db_connection.py
rm Note.txt
rm backup_20250820_123628.sql
```

### Phase 2: Xóa Build Artifacts
```bash
rm -rf web-admin/dist/
rm -rf web-admin/node_modules/
rm web-admin/tsconfig.app.tsbuildinfo
rm web-admin/package-lock.json
```

### Phase 3: Review và xóa Scripts không cần thiết
```bash
# Cần review trước khi xóa
rm web-admin/fix-realtime-counts.sh
rm web-admin/test-error-handling.sh
rm web-admin/test-frontend-api.sh
rm web-admin/restart-and-test.sh
rm web-admin/test-api-endpoints.sh
```

### Phase 4: Xóa Documentation trùng lặp
```bash
# Cần review trước khi xóa
rm web-admin/FINAL_REALTIME_FIX_README.md
rm web-admin/REALTIME_COUNTS_FIX_README.md
rm web-admin/TAB_PANEL_FIX_README.md
```

## Lưu ý quan trọng

1. **Backup trước khi xóa:** Tạo backup của toàn bộ project
2. **Test sau khi xóa:** Đảm bảo application vẫn hoạt động bình thường
3. **Regenerate build artifacts:** Chạy `npm install` và `npm run build` sau khi xóa
4. **Review scripts:** Kiểm tra xem scripts nào thực sự cần thiết

## Ước tính dung lượng tiết kiệm được

- `web-admin/node_modules/`: ~100-200MB
- `web-admin/dist/`: ~10-20MB
- Test files: ~5-10MB
- **Tổng cộng:** ~115-230MB
