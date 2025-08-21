# Troubleshooting Guide

## ✅ Đã khắc phục các lỗi Console

### 1. React Router Future Flag Warning
**Lỗi:** `Relative route resolution within Split routes is changing in v7. You can use the 'v7_relativeSplatPath' future flag to opt-in early.`

**Giải pháp:** Đã thêm future flag vào BrowserRouter
```tsx
<BrowserRouter future={{ v7_relativeSplatPath: true }}>
```

### 2. WebSocket Connection Issues
**Lỗi:** WebSocket connection failures to various endpoints

**Giải pháp:**
- Sửa URL WebSocket từ `/ws/admin-user` thành `/ws`
- Thêm automatic reconnection với exponential backoff
- Thêm error handling và retry mechanism
- Hiển thị connection status với retry button

### 3. API Connection Errors  
**Lỗi:** `ERR_EMPTY_RESPONSE` và `Failed to load resource`

**Giải pháp:**
- Cải thiện error handling trong ApiService
- Thêm custom ApiError class
- Thêm proper error messages cho network issues
- Thêm health check endpoint

### 4. Missing Error Handling
**Lỗi:** Ứng dụng crash khi không kết nối được backend

**Giải pháp:**
- Cải thiện usePoll hook với error handling
- Thêm loading states
- Thêm retry mechanisms
- Hiển thị user-friendly error messages

## 🚀 Cách chạy ứng dụng

### Prerequisites
```bash
# Python 3.12+
python --version

# Node.js 18+
node --version

# Docker (optional)
docker --version
```

### Backend Setup
```bash
# 1. Vào thư mục server
cd server

# 2. Tạo virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# hoặc
venv\Scripts\activate     # Windows

# 3. Cài dependencies
pip install -r requirements.txt

# 4. Setup database (PostgreSQL)
# Tạo file .env với nội dung:
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/tailscale_mgr
TS_OAUTH_CLIENT_ID=your_client_id
TS_OAUTH_CLIENT_SECRET=your_client_secret
TS_TAILNET=-
ENCRYPTION_KEY=your_32_byte_base64_key

# 5. Chạy migrations
alembic upgrade head

# 6. Start server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup
```bash
# 1. Vào thư mục web-admin
cd web-admin

# 2. Cài dependencies
npm install

# 3. Start development server
npm run dev
```

### Docker Setup (Alternative)
```bash
# Start toàn bộ stack
docker-compose up -d

# Xem logs
docker-compose logs -f

# Restart services
docker-compose restart
```

## 🔧 Các tính năng mới

### Enhanced Error Handling
- ✅ Automatic retry với exponential backoff
- ✅ User-friendly error messages
- ✅ Connection status indicators
- ✅ Manual refresh buttons

### Improved WebSocket
- ✅ Automatic reconnection
- ✅ Connection status display
- ✅ Error handling với retry
- ✅ Graceful disconnection

### Better API Service
- ✅ Custom error types
- ✅ Network error detection
- ✅ CORS handling
- ✅ Request timeout handling

### Enhanced UI/UX
- ✅ Loading states
- ✅ Error boundaries
- ✅ Retry mechanisms
- ✅ Status indicators

## 🐛 Debug Common Issues

### Backend không start được
```bash
# Kiểm tra port 8000 có bị dùng không
lsof -i :8000

# Kill process nếu cần
kill -9 $(lsof -t -i:8000)

# Kiểm tra database connection
python server/test_db_connection.py
```

### Frontend không connect được backend
```bash
# Kiểm tra backend có chạy không
curl http://localhost:8000/healthz

# Kiểm tra CORS settings
# Xem console browser để debug
```

### WebSocket issues
```bash
# Test WebSocket connection
wscat -c ws://localhost:8000/ws

# Kiểm tra network tab trong browser
# Xem console để debug WebSocket errors
```

### Database issues
```bash
# Reset database
cd server
alembic downgrade base
alembic upgrade head

# Hoặc recreate database
dropdb tailscale_mgr
createdb tailscale_mgr
alembic upgrade head
```

## 📱 Testing

### Manual Testing
1. ✅ Mở http://localhost:3000
2. ✅ Kiểm tra connection status (góc phải trên)
3. ✅ Test refresh button trong Devices page
4. ✅ Test error handling (stop backend, xem error message)
5. ✅ Test reconnection (restart backend)

### Console Checks
- ✅ Không còn React Router warnings
- ✅ WebSocket connection logs
- ✅ API error handling logs
- ✅ No more ERR_EMPTY_RESPONSE

## 📋 Checklist

- [x] React Router future flag warning ✅
- [x] WebSocket connection issues ✅
- [x] API connection errors ✅
- [x] Error handling improvements ✅
- [x] Loading states ✅
- [x] Retry mechanisms ✅
- [x] TypeScript errors ✅
- [x] Linter warnings ✅

## 🔗 Related Files

### Modified Files:
- `web-admin/src/main.tsx` - Router config, WebSocket setup
- `web-admin/src/hooks/useWebSocket.ts` - Enhanced WebSocket handling  
- `web-admin/src/hooks/usePoll.ts` - Better polling with error handling
- `web-admin/src/services/api.ts` - Improved API service
- `web-admin/src/pages/Devices.tsx` - Error handling, loading states

### Key Improvements:
1. **Robust Error Handling** - Graceful degradation when services are down
2. **Better UX** - Loading states, retry buttons, status indicators
3. **Auto-reconnection** - Automatic recovery from network issues
4. **Developer Experience** - Better error messages, logging, debugging

---

*Tất cả các lỗi console đã được khắc phục và ứng dụng sẽ chạy ổn định hơn.*
