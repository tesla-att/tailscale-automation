from datetime import datetime, timedelta, timezone
from sqlalchemy import select, update
from sqlalchemy.orm import Session
import json

from ..config import settings
from ..models import AuthKey, Event, User, Machine
from ..tailscale import create_auth_key, revoke_auth_key
from ..utils.security import encrypt_plain, mask_key
from ..utils.logging import get_logger
from .notify import announce

log = get_logger(__name__)

async def _create_and_store_key(db: Session, user: User, machine: Machine | None, *, desc: str, ttl: int,
                                reusable=True, ephemeral=False, preauthorized=True, tags=None) -> AuthKey:
    ts = await create_auth_key(description=desc, ttl_seconds=ttl, reusable=reusable,
                               ephemeral=ephemeral, preauthorized=preauthorized, tags=tags or [])
    plain = ts["key"]
    masked = mask_key(plain)
    expires_at = datetime.fromisoformat(ts["expiresAt"].replace("Z","+00:00")) if ts.get("expiresAt") else None

    k = AuthKey(user_id=user.id, machine_id=machine.id if machine else None,
                ts_key_id=ts.get("id"), authkey_ciphertext=encrypt_plain(plain),
                masked=masked, reusable=reusable, ephemeral=ephemeral,
                preauthorized=preauthorized, tags=json.dumps(tags or []),
                ttl_seconds=ttl, expires_at=expires_at, active=True)
    db.add(k)
    db.add(Event(user_id=user.id, machine_id=machine.id if machine else None,
                 type="KEY_CREATED", message=f"{masked} exp={expires_at}"))
    db.commit(); db.refresh(k)
    await announce(f"[Key Created] user={user.email} key={masked} exp={expires_at}")
    return k

async def rotate_if_necessary(db: Session):
    warn_deadline = datetime.now(timezone.utc) + timedelta(days=settings.ROTATE_WARN_DAYS)
    q = select(AuthKey).where(AuthKey.active==True, AuthKey.expires_at!=None, AuthKey.expires_at < warn_deadline)
    keys = db.execute(q).scalars().all()
    for k in keys:
        user = db.get(User, k.user_id)
        machine = db.get(Machine, k.machine_id) if k.machine_id else None
        # 1) create new key
        new_k = await _create_and_store_key(db, user, machine,
                    desc=f"rotate of {k.masked}", ttl=k.ttl_seconds,
                    reusable=k.reusable, ephemeral=k.ephemeral,
                    preauthorized=k.preauthorized, tags=json.loads(k.tags or "[]"))
        # 2) deactivate & revoke old key
        k.active = False
        db.add(Event(user_id=user.id, machine_id=k.machine_id, type="KEY_ROTATED",
                     message=f"{k.masked} -> {new_k.masked}"))
        db.commit()
        if k.ts_key_id:
            try:
                await revoke_auth_key(k.ts_key_id)  # DELETE /keys/{id}
                db.add(Event(user_id=user.id, machine_id=k.machine_id, type="KEY_REVOKED", message=k.masked))
                db.commit()
            except Exception as e:
                log.warning(f"Failed to revoke old key {k.masked}: {e}")
        await announce(f"[Key Rotated] user={user.email} old={k.masked} new={new_k.masked}")
