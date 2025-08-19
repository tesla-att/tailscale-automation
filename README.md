# ATT TAILSCALE MANAGEMENT

A TAILSCALE management system with web interface for creating, managing, and automatically rotating auth keys.

## Features

- ✅ **User Management** - Create and manage users
- ✅ **Auth Key Management** - Create, revoke, and automatically rotate auth keys
- ✅ **Device Monitoring** - View device list in TAILNET
- ✅ **Automatic Rotation** - Automatically create new keys when about to expire
- ✅ **Notifications** - Send alerts via Telegram/Discord
- ✅ **Web Admin Interface** - Web interface for management

## Project Structure

```
tailscale-manager/
├── server/          # FastAPI backend
├── web-admin/       # React frontend  
├── docker-compose.yml
└── README.md
```

## Getting Started

### 1. Create .env file in server/ directory

```bash
cd server
cp .env.example .env
```

Configure environment variables:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@db:5432/tailscale_mgr

# Tailscale OAuth
TS_OAUTH_CLIENT_ID=your_client_id
TS_OAUTH_CLIENT_SECRET=your_client_secret
TS_TAILNET=-
TS_SCOPES=auth_keys devices:core

# Encryption
ENCRYPTION_KEY=your_32_byte_base64_key

# Rotation settings
ROTATE_WARN_DAYS=7
ROTATE_CHECK_INTERVAL_MIN=15

# Notifications (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
DISCORD_WEBHOOK_URL=your_webhook_url
```

### 2. Run database migration

```bash
docker compose run --rm \
  -e DATABASE_URL=postgresql+psycopg://postgres:postgres@db:5432/tailscale_mgr \
  api alembic upgrade head
```

### 3. Start services

```bash
# Run all services
docker compose up -d

# Or backend only
docker compose up api db -d

# Or frontend only (backend must be running first)
docker compose up web -d
```

### 4. Access

- **API Backend**: http://localhost:8000
- **Web Admin**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs

## Development

### Backend (FastAPI)

```bash
cd server
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend (React + VITE)

```bash
cd web-admin
npm install
npm run dev
```

## API Endpoints

- `GET /api/devices` - List devices
- `GET /api/users` - List users
- `POST /api/users` - Create new user
- `POST /api/keys` - Create auth key
- `POST /api/keys/{id}/revoke` - Revoke auth key
- `GET /agent/authkey` - Endpoint for Windows agent

## Automatic Rotation

The system automatically checks and rotates auth keys that are about to expire:

- Check every 15 minutes (configurable)
- Warning 7 days before expiration
- Automatically create new key and revoke old key
- Send notifications via Telegram/Discord

## Security

- Auth keys are encrypted with Fernet before storing in database
- Only masked version is displayed in UI
- Database credentials and API keys should be properly secured

## Quick Start

### Sử dụng script tự động:
```bash
cd /opt/tailscale-manager
./start-system.sh
```

### Kiểm tra hệ thống:
```bash
./healthcheck.sh
```

## Troubleshooting

### Reset database

```bash
docker compose down -v
docker compose up -d db
# Run migration again
```

### View logs

```bash
docker compose logs api
docker compose logs web
```

### Hướng dẫn chi tiết

Xem file [STARTUP_GUIDE.md](./STARTUP_GUIDE.md) để có hướng dẫn đầy đủ về cách khởi động và quản lý hệ thống.
