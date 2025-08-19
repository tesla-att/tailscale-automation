from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models import User, Machine, AuthKey, Event
from ..schemas import CreateKeyReq, AgentKeyOut, KeyOut
from ..services.rotate import _create_and_store_key
from ..tailscale import revoke_auth_key
from ..utils.security import decrypt_cipher
from ..utils.logging import get_logger

router = APIRouter(prefix="/api/keys", tags=["keys"])
log = get_logger(__name__)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@router.post("", response_model=KeyOut)
async def create_key(body: CreateKeyReq, db: Session=Depends(get_db)):
    user = db.get(User, body.user_id) or HTTPException(404, "user not found")
    machine = db.get(Machine, body.machine_id) if body.machine_id else None
    k = await _create_and_store_key(db, user, machine,
            desc=body.description or f"user:{user.email}",
            ttl=body.ttl_seconds, reusable=body.reusable, ephemeral=body.ephemeral,
            preauthorized=body.preauthorized, tags=body.tags)
    return KeyOut(id=k.id, masked=k.masked, expires_at=k.expires_at, active=k.active)

@router.post("/{id}/revoke")
async def revoke_key(id: str, db: Session=Depends(get_db)):
    k = db.get(AuthKey, id) or HTTPException(404, "key not found")
    if k.ts_key_id:
        await revoke_auth_key(k.ts_key_id)
    k.active = False
    db.add(Event(user_id=k.user_id, machine_id=k.machine_id, type="KEY_REVOKED", message=k.masked))
    db.commit()
    return {"ok": True}

# --- Endpoint cho Agent Windows lấy authkey hiện hành ---
agent = APIRouter(prefix="/agent", tags=["agent"])

@agent.get("/authkey", response_model=AgentKeyOut)
async def agent_authkey(user: str = Query(...), machine: str = Query(...), db: Session=Depends(get_db)):
    u = db.get(User, user) or HTTPException(404, "user not found")
    # tìm key active mới nhất cho user (có thể gắn theo machine nếu bạn muốn)
    k = db.query(AuthKey).filter(AuthKey.user_id==u.id, AuthKey.active==True).order_by(AuthKey.created_at.desc()).first()
    if not k:
        # tạo mới lần đầu (mặc định 30 ngày)
        k = await _create_and_store_key(db, u, None, desc=f"user:{u.email}", ttl=60*60*24*30)
    return AgentKeyOut(authkey=decrypt_cipher(k.authkey_ciphertext))
