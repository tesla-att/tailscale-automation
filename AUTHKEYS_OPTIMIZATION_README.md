# AuthKeys Optimization & Tailscale Integration

## Tổng quan

Phần authkeys đã được tối ưu hóa hoàn toàn và tích hợp đầy đủ với Tailscale API, cung cấp các chức năng quản lý authentication keys nâng cao.

## Các tính năng mới

### 1. Tích hợp hoàn toàn với Tailscale API

- **Tạo key**: Tạo authentication keys trực tiếp thông qua Tailscale API
- **Quản lý key**: Revoke, reactivate, và cập nhật keys
- **Đồng bộ dữ liệu**: Tự động đồng bộ giữa database local và Tailscale
- **Health check**: Kiểm tra trạng thái kết nối với Tailscale API

### 2. Giao diện người dùng nâng cao

- **Dashboard thống kê**: Hiển thị tổng quan về keys (tổng số, active, expired, revoked, expiring soon)
- **Bộ lọc nâng cao**: Lọc theo status, user, machine, và include inactive keys
- **Modal chi tiết**: Xem thông tin chi tiết của từng key
- **Form tạo key**: Giao diện tạo key với nhiều tùy chọn

### 3. Quản lý key nâng cao

- **TTL linh hoạt**: Từ 5 phút đến 1 năm
- **Tags**: Hỗ trợ tagging cho keys
- **User/Machine binding**: Gắn key với user hoặc machine cụ thể
- **Capabilities**: Reusable, ephemeral, preauthorized options
- **Usage tracking**: Theo dõi số lần sử dụng key

### 4. Bảo mật và tuân thủ

- **Key masking**: Hiển thị key dưới dạng masked để bảo mật
- **One-time display**: Full key chỉ hiển thị một lần khi tạo
- **Audit trail**: Ghi lại tất cả các thao tác với keys
- **Permission validation**: Kiểm tra quyền và capabilities của key

## Cấu trúc API mới

### Endpoints

```
GET    /api/keys              - Lấy danh sách keys với filtering
GET    /api/keys/stats        - Thống kê tổng quan
POST   /api/keys              - Tạo key mới
GET    /api/keys/{id}         - Lấy thông tin chi tiết key
PUT    /api/keys/{id}         - Cập nhật key
POST   /api/keys/{id}/revoke  - Revoke key
POST   /api/keys/{id}/reactivate - Reactivate key
GET    /api/keys/{id}/usage   - Thống kê sử dụng key
GET    /api/keys/health/check - Kiểm tra sức khỏe Tailscale API
```

### Models

#### AuthKey
```typescript
interface AuthKey {
  id: string;
  ts_key_id: string;           // Tailscale key ID
  description: string;
  key?: string;                 // Full key (chỉ hiển thị khi tạo)
  key_masked: string;           // Masked key
  status: string;               // active, expired, revoked
  expires_at: string;
  uses: number;
  max_uses?: number;
  reusable: boolean;
  ephemeral: boolean;
  preauthorized: boolean;
  tags: string[];
  user_email?: string;
  machine_hostname?: string;
  permissions: any;
}
```

#### AuthKeyStats
```typescript
interface AuthKeyStats {
  total_keys: number;
  active_keys: number;
  expired_keys: number;
  revoked_keys: number;
  keys_expiring_soon: number;
  tailnet_info: any;
}
```

## Cách sử dụng

### 1. Tạo key mới

```typescript
const newKey = await ApiService.post("/keys", {
  description: "Production server access",
  ttl_seconds: 86400,          // 1 ngày
  reusable: true,
  ephemeral: false,
  preauthorized: true,
  tags: ["production", "server"],
  user_id: "user-uuid",        // optional
  machine_id: "machine-uuid"   // optional
});
```

### 2. Lấy danh sách keys với filter

```typescript
const keys = await ApiService.get("/keys?status=active&include_inactive=false");
```

### 3. Revoke key

```typescript
await ApiService.post(`/keys/${keyId}/revoke`, {});
```

### 4. Lấy thống kê

```typescript
const stats = await ApiService.get("/keys/stats");
```

## Tối ưu hóa Tailscale Service

### Các function mới

- `create_auth_key()`: Tạo key với capabilities nâng cao
- `revoke_auth_key()`: Revoke key
- `get_auth_key_details()`: Lấy thông tin chi tiết key
- `list_auth_keys()`: Lấy danh sách tất cả keys
- `update_auth_key()`: Cập nhật key
- `get_key_usage_stats()`: Thống kê sử dụng
- `validate_key_permissions()`: Kiểm tra quyền
- `health_check()`: Kiểm tra sức khỏe API

### Capabilities

- **User restrictions**: Giới hạn key cho user cụ thể
- **Machine restrictions**: Giới hạn key cho machine cụ thể
- **Tag-based access**: Kiểm soát truy cập dựa trên tags
- **Ephemeral devices**: Hỗ trợ thiết bị tạm thời
- **Preauthorized access**: Truy cập được ủy quyền trước

## Frontend Components

### 1. Keys.tsx (Main Component)
- Dashboard với thống kê
- Bộ lọc nâng cao
- Bảng hiển thị keys
- Modal tạo key mới

### 2. CreateKeyForm
- Form tạo key với validation
- Tùy chọn TTL, capabilities
- Tag management
- User/Machine selection

### 3. KeyDetailsModal
- Hiển thị thông tin chi tiết key
- Usage statistics
- Permission details
- Action buttons

### 4. KeyActions
- View details
- Revoke/Reactivate
- Copy key

## Cấu hình

### Environment Variables

```bash
TS_OAUTH_CLIENT_ID=your_client_id
TS_OAUTH_CLIENT_SECRET=your_client_secret
TS_TAILNET=your_tailnet_name
TS_SCOPES=auth_keys devices:core
```

### Database Schema

Bảng `auth_keys` đã được mở rộng với các trường mới:
- `ts_key_id`: ID của key trong Tailscale
- `key_encrypted`: Key được mã hóa
- `key_masked`: Key dạng masked
- `reusable`, `ephemeral`, `preauthorized`: Capabilities
- `tags`: JSON array của tags
- `ttl_seconds`: Thời gian sống của key

## Monitoring & Health Check

### Tailscale API Health
- Kiểm tra kết nối OAuth
- Đo thời gian phản hồi API
- Thông tin tailnet
- Log lỗi và cảnh báo

### Key Management Metrics
- Tổng số keys
- Keys sắp hết hạn
- Usage patterns
- Revocation history

## Bảo mật

### Key Protection
- Keys được mã hóa trong database
- Full key chỉ hiển thị một lần
- Masked display cho UI
- Audit logging cho tất cả operations

### Access Control
- User-based restrictions
- Machine-based restrictions
- Tag-based access control
- Permission validation

## Troubleshooting

### Common Issues

1. **Tailscale API Connection Failed**
   - Kiểm tra OAuth credentials
   - Verify network connectivity
   - Check API scopes

2. **Key Creation Failed**
   - Validate TTL values
   - Check user/machine existence
   - Verify permissions

3. **Sync Issues**
   - Check database connectivity
   - Verify Tailscale API health
   - Review error logs

### Debug Commands

```bash
# Check Tailscale API health
curl http://localhost:8000/api/keys/health/check

# Get key statistics
curl http://localhost:8000/api/keys/stats

# List all keys
curl http://localhost:8000/api/keys
```

## Roadmap

### Phase 2 (Planned)
- Bulk operations (create, revoke multiple keys)
- Advanced filtering và search
- Key rotation automation
- Integration với external systems
- Advanced analytics và reporting

### Phase 3 (Future)
- Machine learning cho key usage patterns
- Automated security recommendations
- Integration với SIEM systems
- Advanced compliance reporting

## Kết luận

Phần authkeys đã được tối ưu hóa hoàn toàn với:
- Tích hợp đầy đủ với Tailscale API
- Giao diện người dùng hiện đại và thân thiện
- Quản lý key nâng cao với nhiều tùy chọn
- Bảo mật và tuân thủ cao
- Monitoring và health check toàn diện

Hệ thống này cung cấp nền tảng vững chắc cho việc quản lý authentication keys trong môi trường Tailscale enterprise.
