from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
from .config import settings
from .db import SessionLocal
from .routers import devices, users, authkeys, portforwards, analytics, deployment
from .services.rotate import rotate_if_necessary
from .websockets import notification_manager, websocket_endpoint
import json
from datetime import datetime, timezone

app = FastAPI(title="ATT Tailscale Manager API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(devices.router, prefix="/api/devices", tags=["devices"])
app.include_router(authkeys.router, prefix="/api/auth-keys", tags=["auth-keys"])
app.include_router(authkeys.agent, prefix="/api/auth-keys/agent", tags=["auth-keys-agent"])
app.include_router(portforwards.router, prefix="/api/port-forwards", tags=["port-forwards"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(deployment.router, prefix="/api/deployment", tags=["deployment"])


scheduler = AsyncIOScheduler()

def _rotate_job():
    db: Session = SessionLocal()
    try:
        import asyncio
        # Tạo event loop mới cho thread background
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(rotate_if_necessary(db))
        finally:
            loop.close()
    finally:
        db.close()

@app.on_event("startup")
async def startup():
    # cron kiểm tra xoay vòng
    scheduler.add_job(_rotate_job, "interval", minutes=settings.ROTATE_CHECK_INTERVAL_MIN, id="rotate")
    scheduler.start()

# WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                self.disconnect(connection)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/healthz")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}