from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
from .config import settings
from .db import SessionLocal
from .routers import devices, users, authkeys, portforwards, analytics, windows_deployment
from .services.rotate import rotate_if_necessary
from .websockets import notification_manager

app = FastAPI(title="ATT Tailscale Manager")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router)
app.include_router(users.router)
app.include_router(authkeys.router)
app.include_router(authkeys.agent)
app.include_router(portforwards.router)
app.include_router(analytics.router)
app.include_router(windows_deployment.router)

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

@app.get("/healthz")
def healthz(): return {"ok": True}

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await notification_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
    except WebSocketDisconnect:
        notification_manager.disconnect(user_id)