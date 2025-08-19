import httpx, time
from datetime import datetime
from .config import settings
from .utils.logging import get_logger

log = get_logger(__name__)

TS_API = "https://api.tailscale.com/api/v2"
TOKEN_URL = "https://api.tailscale.com/api/v2/oauth/token"

_token_cache = {"val": None, "exp": 0.0}

async def _get_access_token() -> str:
    now = time.time()
    if _token_cache["val"] and now < _token_cache["exp"] - 30:
        return _token_cache["val"]
    data = {"grant_type": "client_credentials", "scope": settings.TS_SCOPES}
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(TOKEN_URL, data=data, auth=(settings.TS_OAUTH_CLIENT_ID, settings.TS_OAUTH_CLIENT_SECRET))
        r.raise_for_status()
        obj = r.json()
        _token_cache["val"] = obj["access_token"]
        _token_cache["exp"] = now + obj.get("expires_in", 3600)
        return _token_cache["val"]

async def _headers():
    tok = await _get_access_token()
    return {"Authorization": f"Bearer {tok}"}

async def create_auth_key(*, description: str, ttl_seconds: int, reusable: bool=True,
                          ephemeral: bool=False, preauthorized: bool=True, tags: list[str]|None=None):
    payload = {
        "description": description,
        "expirySeconds": ttl_seconds,
        "capabilities": {"devices": {"create": {
            "reusable": reusable, "ephemeral": ephemeral, "preauthorized": preauthorized, "tags": tags or []
        }}}
    }
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{TS_API}/tailnet/{settings.TS_TAILNET}/keys", headers=await _headers(), json=payload)
        r.raise_for_status()
        return r.json()  # {id, key, expiresAt, ...}

async def revoke_auth_key(ts_key_id: str):
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.delete(f"{TS_API}/tailnet/{settings.TS_TAILNET}/keys/{ts_key_id}", headers=await _headers())
        r.raise_for_status()
        return True

async def list_devices():
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{TS_API}/tailnet/{settings.TS_TAILNET}/devices", headers=await _headers())
        r.raise_for_status()
        return r.json()
