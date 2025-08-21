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
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173",
        "http://localhost:4173",  # Vite preview
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(devices.router, prefix="/api/devices", tags=["devices"])
app.include_router(authkeys.router, prefix="/api/authkeys", tags=["authkeys"])
# app.include_router(authkeys.agent, prefix="/api/authkeys/agent", tags=["authkeys-agent"]) # TODO: remove this - REMOVED: agent router doesn't exist
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

# WebSocket endpoint - using notification_manager from websockets module
@app.websocket("/ws")
async def websocket_endpoint_handler(websocket: WebSocket):
    print(f"WebSocket connection attempt from: {websocket.client}")
    await websocket_endpoint(websocket)

@app.get("/healthz")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/healthz")
async def api_health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}