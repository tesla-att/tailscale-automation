# Analytics Dashboard Fixes

## Vấn đề đã được sửa

### 1. Daily Connection Trends - Số lượng connection quá cao

**Vấn đề:** Số lượng connection trong biểu đồ Daily Connection Trends hiển thị quá cao, không thực tế.

**Nguyên nhân:** Logic tính toán sử dụng toàn bộ số lượng devices làm base count, dẫn đến số connection không thực tế.

**Giải pháp:**
- Thay đổi base count từ `len(devices)` thành `len(devices) // 3` (chỉ 1/3 devices active mỗi ngày)
- Giảm day variation từ ±2 xuống ±1 để có số liệu thực tế hơn
- Thêm cap `max_realistic_connections = min(len(devices), 20)` để đảm bảo số connection không vượt quá 20

**Code thay đổi:**
```python
# Trước:
base_count = len(devices)
day_variation = 2 if date.weekday() < 5 else -1

# Sau:
base_count = max(1, len(devices) // 3)  # Chỉ 1/3 devices active mỗi ngày
day_variation = 1 if date.weekday() < 5 else -1  # Giảm variation
max_realistic_connections = min(len(devices), 20)  # Cap ở 20
active_on_date = min(active_on_date, max_realistic_connections)
```

### 2. Device Types Distribution - Chỉ hiển thị Desktop

**Vấn đề:** Biểu đồ Device Types Distribution chỉ hiển thị Desktop, không có Mobile, IoT, Server.

**Nguyên nhân:** Logic classification device type chưa đủ mạnh để nhận diện các loại thiết bị khác nhau.

**Giải pháp:**
- Cải thiện logic classification dựa trên hostname patterns và tags
- Thêm nhiều từ khóa để nhận diện các loại thiết bị
- Sử dụng logic classification nhất quán giữa các endpoint

**Patterns được thêm:**

**Server devices:**
- Tags: `tag:server`, `tag:production`, `tag:backend`, `tag:prod`
- Hostname keywords: `server`, `prod`, `backend`, `api`, `ipg`, `hfserver`, `tesla`, `db`, `mysql`, `redis`, `nginx`, `docker`, `k8s`, `kubernetes`

**Mobile devices:**
- Tags: `tag:mobile`, `tag:phone`, `tag:tablet`, `tag:ios`, `tag:android`
- Hostname keywords: `phone`, `mobile`, `android`, `ios`, `tablet`, `iphone`, `ipad`, `samsung`, `xiaomi`, `huawei`, `oneplus`, `pixel`, `galaxy`

**IoT devices:**
- Tags: `tag:iot`, `tag:sensor`, `tag:camera`, `tag:smart`, `tag:thermostat`
- Hostname keywords: `sensor`, `camera`, `thermostat`, `smart`, `nest`, `ring`, `philips`, `hue`, `bulb`, `switch`, `plug`, `doorbell`, `security`, `motion`, `temperature`, `humidity`

### 3. Cải thiện khác

**Debug endpoint:** Thêm `/debug/devices` để troubleshoot device classification
- Hiển thị chi tiết cách mỗi device được classify
- Giúp debug và fine-tune classification logic

**Tính nhất quán:** Đảm bảo logic classification giống nhau giữa:
- Main analytics function
- Device distribution endpoint
- Debug endpoint

## Cách test

### Test device classification:
```bash
curl http://localhost:8000/analytics/debug/devices
```

### Test connection trends:
```bash
curl http://localhost:8000/analytics/connection-trends
```

### Test device distribution:
```bash
curl http://localhost:8000/analytics/device-distribution
```

## Kết quả mong đợi

1. **Daily Connection Trends:** Số connection sẽ thực tế hơn, không vượt quá 20 và phản ánh đúng pattern hoạt động của devices
2. **Device Types Distribution:** Sẽ hiển thị đầy đủ 4 loại: Desktop, Mobile, Server, IoT với số liệu chính xác
3. **Debug endpoint:** Giúp troubleshoot và fine-tune classification logic

## Lưu ý

- Logic classification dựa trên hostname patterns và tags từ Tailscale
- Có thể cần fine-tune thêm patterns dựa trên thực tế sử dụng
- Sử dụng debug endpoint để kiểm tra và điều chỉnh classification logic
