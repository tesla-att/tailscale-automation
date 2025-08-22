import httpx, time, json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
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
    
    try:
        data = {"grant_type": "client_credentials", "scope": settings.TS_SCOPES}
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(TOKEN_URL, data=data, auth=(settings.TS_OAUTH_CLIENT_ID, settings.TS_OAUTH_CLIENT_SECRET))
            r.raise_for_status()
            obj = r.json()
            _token_cache["val"] = obj["access_token"]
            _token_cache["exp"] = now + obj.get("expires_in", 3600)
            log.info(f"Successfully obtained Tailscale OAuth token, expires in {obj.get('expires_in', 3600)}s")
            return _token_cache["val"]
    except Exception as e:
        log.error(f"Failed to obtain Tailscale OAuth token: {e}")
        raise

async def _headers():
    tok = await _get_access_token()
    return {"Authorization": f"Bearer {tok}"}

async def create_auth_key(*, description: str, ttl_seconds: int, reusable: bool=True,
                          ephemeral: bool=False, preauthorized: bool=True, tags: List[str]|None=None,
                          user_id: Optional[str] = None, machine_id: Optional[str] = None):
    """Create a new Tailscale auth key with enhanced capabilities"""
    try:
        # Use default tag if none provided (Tailscale requires tags)
        if not tags:
            tags = ["tag:employee"]
        
        # Tailscale API v2 format with required capabilities
        payload = {
            "description": description,
            "expirySeconds": ttl_seconds,
            "capabilities": {
                "devices": {
                    "create": {
                        "reusable": reusable,
                        "ephemeral": ephemeral,
                        "preauthorized": preauthorized,
                        "tags": tags
                    }
                }
            }
        }
        
        # Add user-specific capabilities if user_id is provided
        if user_id:
            payload["capabilities"]["devices"]["create"]["user"] = user_id
        
        # Add machine-specific capabilities if machine_id is provided
        if machine_id:
            payload["capabilities"]["devices"]["create"]["machine"] = machine_id
        
        log.info(f"Creating Tailscale auth key with payload: {json.dumps(payload, indent=2)}")
        
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{TS_API}/tailnet/{settings.TS_TAILNET}/keys", headers=await _headers(), json=payload)
            
            if r.status_code == 400:
                error_detail = r.json() if r.headers.get("content-type") == "application/json" else r.text
                log.error(f"Tailscale API 400 error: {error_detail}")
                log.error(f"Request payload: {json.dumps(payload, indent=2)}")
                log.error(f"Response headers: {dict(r.headers)}")
                raise Exception(f"Tailscale API validation error: {error_detail}")
            
            r.raise_for_status()
            result = r.json()
            log.info(f"Successfully created Tailscale auth key: {result.get('id', 'unknown')}")
            return result
    except Exception as e:
        log.error(f"Failed to create Tailscale auth key: {e}")
        raise

async def revoke_auth_key(ts_key_id: str):
    """Revoke a Tailscale auth key"""
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.delete(f"{TS_API}/tailnet/{settings.TS_TAILNET}/keys/{ts_key_id}", headers=await _headers())
            r.raise_for_status()
            log.info(f"Successfully revoked Tailscale auth key: {ts_key_id}")
            return True
    except Exception as e:
        log.error(f"Failed to revoke Tailscale auth key {ts_key_id}: {e}")
        raise

async def get_auth_key_details(ts_key_id: str) -> Dict[str, Any]:
    """Get detailed information about a specific auth key"""
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(f"{TS_API}/tailnet/{settings.TS_TAILNET}/keys/{ts_key_id}", headers=await _headers())
            r.raise_for_status()
            result = r.json()
            log.info(f"Successfully retrieved details for Tailscale auth key: {ts_key_id}")
            return result
    except Exception as e:
        log.error(f"Failed to get details for Tailscale auth key {ts_key_id}: {e}")
        raise

async def list_auth_keys() -> List[Dict[str, Any]]:
    """List all auth keys in the tailnet"""
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{TS_API}/tailnet/{settings.TS_TAILNET}/keys", headers=await _headers())
            r.raise_for_status()
            result = r.json().get("keys", [])
            log.info(f"Successfully retrieved {len(result)} Tailscale auth keys")
            return result
    except Exception as e:
        log.error(f"Failed to list Tailscale auth keys: {e}")
        raise

async def update_auth_key(ts_key_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update an existing auth key (limited fields can be updated)"""
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.patch(f"{TS_API}/tailnet/{settings.TS_TAILNET}/keys/{ts_key_id}", 
                             headers=await _headers(), json=updates)
            r.raise_for_status()
            result = r.json()
            log.info(f"Successfully updated Tailscale auth key: {ts_key_id}")
            return result
    except Exception as e:
        log.error(f"Failed to update Tailscale auth key {ts_key_id}: {e}")
        raise

async def get_key_usage_stats(ts_key_id: str) -> Dict[str, Any]:
    """Get usage statistics for a specific auth key"""
    try:
        key_details = await get_auth_key_details(ts_key_id)
        result = {
            "uses": key_details.get("uses", 0),
            "max_uses": key_details.get("maxUses", None),
            "last_used": key_details.get("lastUsed", None),
            "created": key_details.get("created", None),
            "expires": key_details.get("expires", None)
        }
        log.info(f"Successfully retrieved usage stats for key {ts_key_id}")
        return result
    except Exception as e:
        log.error(f"Failed to get key usage stats for {ts_key_id}: {e}")
        return {}

async def validate_key_permissions(ts_key_id: str) -> Dict[str, Any]:
    """Validate and return key permissions and capabilities"""
    try:
        key_details = await get_auth_key_details(ts_key_id)
        capabilities = key_details.get("capabilities", {})
        
        result = {
            "can_create_devices": capabilities.get("devices", {}).get("create", False),
            "reusable": capabilities.get("devices", {}).get("create", {}).get("reusable", False),
            "ephemeral": capabilities.get("devices", {}).get("create", {}).get("ephemeral", False),
            "preauthorized": capabilities.get("devices", {}).get("create", {}).get("preauthorized", False),
            "tags": capabilities.get("devices", {}).get("create", {}).get("tags", []),
            "user_restrictions": capabilities.get("devices", {}).get("create", {}).get("user", None),
            "machine_restrictions": capabilities.get("devices", {}).get("create", {}).get("machine", None)
        }
        log.info(f"Successfully validated permissions for key {ts_key_id}")
        return result
    except Exception as e:
        log.error(f"Failed to validate key permissions for {ts_key_id}: {e}")
        return {}

async def list_devices():
    """List all devices in the tailnet"""
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{TS_API}/tailnet/{settings.TS_TAILNET}/devices", headers=await _headers())
            r.raise_for_status()
            result = r.json()
            log.info(f"Successfully retrieved Tailscale devices")
            return result
    except Exception as e:
        log.error(f"Failed to list Tailscale devices: {e}")
        raise

async def get_device_by_id(device_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific device by ID"""
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(f"{TS_API}/tailnet/{settings.TS_TAILNET}/devices/{device_id}", headers=await _headers())
            r.raise_for_status()
            result = r.json()
            log.info(f"Successfully retrieved Tailscale device: {device_id}")
            return result
    except Exception as e:
        log.error(f"Failed to get Tailscale device {device_id}: {e}")
        return None

async def get_tailnet_info() -> Dict[str, Any]:
    """Get tailnet information and statistics"""
    try:
        # Try to get tailnet info from devices endpoint first
        devices = await list_devices()
        if devices and isinstance(devices, dict) and "devices" in devices:
            # Extract some basic info from devices response
            device_count = len(devices["devices"])
            return {
                "name": settings.TS_TAILNET,
                "device_count": device_count,
                "status": "active"
            }
        else:
            return {
                "name": settings.TS_TAILNET,
                "status": "active",
                "note": "Info extracted from devices endpoint"
            }
    except Exception as e:
        log.error(f"Failed to get tailnet info: {e}")
        return {
            "name": settings.TS_TAILNET,
            "status": "error",
            "error": str(e)
        }

async def get_user_info(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user information from Tailscale"""
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(f"{TS_API}/tailnet/{settings.TS_TAILNET}/users/{user_id}", headers=await _headers())
            r.raise_for_status()
            result = r.json()
            log.info(f"Successfully retrieved Tailscale user: {user_id}")
            return result
    except Exception as e:
        log.error(f"Failed to get Tailscale user {user_id}: {e}")
        return None

async def list_users() -> List[Dict[str, Any]]:
    """List all users in the tailnet"""
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(f"{TS_API}/tailnet/{settings.TS_TAILNET}/users", headers=await _headers())
            r.raise_for_status()
            result = r.json().get("users", [])
            log.info(f"Successfully retrieved {len(result)} Tailscale users")
            return result
    except Exception as e:
        log.error(f"Failed to list Tailscale users: {e}")
        return []

async def health_check() -> Dict[str, Any]:
    """Check Tailscale API health and connectivity"""
    try:
        start_time = time.time()
        token = await _get_access_token()
        token_time = time.time() - start_time
        
        # Test basic API call
        api_start = time.time()
        try:
            devices = await list_devices()
            api_time = time.time() - api_start
            device_count = len(devices.get("devices", [])) if devices else 0
            
            return {
                "status": "healthy",
                "token_generation_time": round(token_time, 3),
                "api_response_time": round(api_time, 3),
                "tailnet_name": settings.TS_TAILNET,
                "device_count": device_count,
                "last_check": datetime.utcnow().isoformat()
            }
        except Exception as api_error:
            return {
                "status": "partially_healthy",
                "token_generation_time": round(token_time, 3),
                "api_response_time": None,
                "tailnet_name": settings.TS_TAILNET,
                "error": f"API call failed: {str(api_error)}",
                "last_check": datetime.utcnow().isoformat()
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "last_check": datetime.utcnow().isoformat()
        }
