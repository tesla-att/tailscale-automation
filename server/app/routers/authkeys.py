from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db import get_db
from ..models import AuthKey, User, Machine
from ..tailscale import (
    create_auth_key, revoke_auth_key, get_auth_key_details, 
    list_auth_keys as ts_list_keys, get_key_usage_stats, 
    validate_key_permissions, health_check, get_tailnet_info
)
from pydantic import BaseModel, Field
from datetime import datetime, timedelta, timezone
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class AuthKeyCreate(BaseModel):
    description: str = Field(..., description="Description for the auth key")
    ttl_seconds: int = Field(..., ge=300, le=31536000, description="Time to live in seconds (5min to 1 year)")
    reusable: bool = Field(True, description="Whether the key can be reused")
    ephemeral: bool = Field(False, description="Whether devices using this key are ephemeral")
    preauthorized: bool = Field(True, description="Whether devices are preauthorized")
    tags: List[str] = Field(default=[], description="Tags to apply to devices")
    user_id: Optional[str] = Field(None, description="Restrict key to specific user")
    machine_id: Optional[str] = Field(None, description="Restrict key to specific machine")

class AuthKeyUpdate(BaseModel):
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    active: Optional[bool] = None

class AuthKeyResponse(BaseModel):
    id: str
    ts_key_id: str
    description: str
    key: Optional[str] = None  # Only shown on creation
    key_masked: str
    status: str
    expires_at: str
    uses: int
    max_uses: Optional[int]
    created_at: str
    tags: List[str]
    reusable: bool
    ephemeral: bool
    preauthorized: bool
    user_email: Optional[str] = None
    machine_hostname: Optional[str] = None
    permissions: dict

class AuthKeyStats(BaseModel):
    total_keys: int
    active_keys: int
    expired_keys: int
    revoked_keys: int
    keys_expiring_soon: int
    tailnet_info: dict

@router.get("", response_model=List[AuthKeyResponse])
async def list_auth_keys(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter by status: active, expired, revoked"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    machine_id: Optional[str] = Query(None, description="Filter by machine ID"),
    include_inactive: bool = Query(False, description="Include inactive keys")
):
    """Get all auth keys with optional filtering"""
    try:
        # Get keys from database
        query = db.query(AuthKey)
        
        # Apply include_inactive filter
        if not include_inactive:
            # Only show active keys (not revoked and not expired)
            query = query.filter(AuthKey.revoked == False)
        # If include_inactive is True, show all keys including revoked and expired
        
        if user_id:
            query = query.filter(AuthKey.user_id == user_id)
        
        if machine_id:
            query = query.filter(AuthKey.machine_id == machine_id)
        
        db_keys = query.all()
        logger.info(f"Found {len(db_keys)} keys in database")
        
        # Try to sync with Tailscale if possible
        ts_keys = []
        try:
            ts_keys = await ts_list_keys()
            logger.info(f"Successfully retrieved {len(ts_keys)} keys from Tailscale")
        except Exception as e:
            logger.warning(f"Failed to sync with Tailscale: {e}. Continuing with database data only.")
            ts_keys = []
        
        ts_key_map = {k["id"]: k for k in ts_keys}
        
        key_list = []
        for key in db_keys:
            try:
                # Get user and machine info
                user = db.query(User).filter(User.id == key.user_id).first() if key.user_id else None
                machine = db.query(Machine).filter(Machine.id == key.machine_id).first() if key.machine_id else None
                
                # Determine status
                now = datetime.utcnow().replace(tzinfo=timezone.utc)
                expires_at = key.expires_at
                
                # Handle different datetime formats
                if isinstance(expires_at, str):
                    try:
                        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    except ValueError:
                        # Fallback for other date formats
                        expires_at = datetime.fromisoformat(expires_at)
                elif expires_at and hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is None:
                    # If datetime is naive, assume UTC
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                
                # Ensure expires_at has timezone info
                if expires_at and hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                
                if key.revoked:
                    key_status = "revoked"
                elif expires_at and expires_at < now:
                    key_status = "expired"
                else:
                    key_status = "active"
                
                # Apply status filter if specified
                if status and key_status != status:
                    continue
                
                # Get Tailscale key details if available
                permissions = {}
                if key.ts_key_id and key.ts_key_id in ts_key_map:
                    try:
                        permissions = await validate_key_permissions(key.ts_key_id)
                    except Exception as e:
                        logger.warning(f"Failed to get permissions for key {key.ts_key_id}: {e}")
                        permissions = {}
                
                key_list.append(AuthKeyResponse(
                    id=key.id,
                    ts_key_id=key.ts_key_id or "",
                    description=key.description or "",
                    key_masked=key.key_masked or key.masked or "Unknown",
                    status=key_status,
                    expires_at=key.expires_at.isoformat() if hasattr(key.expires_at, 'isoformat') else str(key.expires_at),
                    uses=key.uses or 0,
                    max_uses=ts_key_map.get(key.ts_key_id, {}).get("maxUses"),
                    created_at=key.created_at.isoformat() if hasattr(key.created_at, 'isoformat') else str(key.created_at),
                    tags=json.loads(key.tags) if key.tags and isinstance(key.tags, str) else (key.tags or []),
                    reusable=key.reusable,
                    ephemeral=key.ephemeral,
                    preauthorized=key.preauthorized,
                    user_email=user.email if user else None,
                    machine_hostname=machine.hostname if machine else None,
                    permissions=permissions
                ))
            except Exception as e:
                logger.error(f"Error processing key {key.id}: {e}")
                continue
        
        logger.info(f"Returning {len(key_list)} filtered keys")
        return key_list
        
    except Exception as e:
        logger.error(f"Failed to list auth keys: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list auth keys: {str(e)}")

@router.get("/stats", response_model=AuthKeyStats)
async def get_auth_key_stats(db: Session = Depends(get_db)):
    """Get comprehensive statistics about auth keys"""
    try:
        # Database stats
        total_keys = db.query(AuthKey).count()
        
        # Count keys by status with proper timezone handling
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        active_keys = 0
        expired_keys = 0
        keys_expiring_soon = 0
        revoked_keys = 0
        
        all_keys = db.query(AuthKey).all()
        for key in all_keys:
            # Check if key is revoked first
            if key.revoked:
                revoked_keys += 1
                continue
            
            # Check expiration
            expires_at = key.expires_at
            
            # Handle different datetime formats
            if isinstance(expires_at, str):
                try:
                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                except ValueError:
                    # Fallback for other date formats
                    expires_at = datetime.fromisoformat(expires_at)
            elif expires_at and hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is None:
                # If datetime is naive, assume UTC
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            # Ensure expires_at has timezone info
            if expires_at and hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at and expires_at < now:
                expired_keys += 1
            else:
                active_keys += 1
            
            # Keys expiring soon (within 7 days)
            soon = now + timedelta(days=7)
            if expires_at and expires_at < soon and expires_at > now and not key.revoked:
                keys_expiring_soon += 1
        
        # Tailnet info
        try:
            tailnet_info = await get_tailnet_info()
            logger.info(f"Successfully retrieved tailnet info: {tailnet_info}")
        except Exception as e:
            logger.warning(f"Failed to get tailnet info: {e}")
            tailnet_info = {"error": "Unable to fetch tailnet info", "details": str(e)}
        
        stats = AuthKeyStats(
            total_keys=total_keys,
            active_keys=active_keys,
            expired_keys=expired_keys,
            revoked_keys=revoked_keys,
            keys_expiring_soon=keys_expiring_soon,
            tailnet_info=tailnet_info
        )
        
        logger.info(f"Generated stats: {stats}")
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get auth key stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get auth key stats: {str(e)}")

@router.post("", response_model=AuthKeyResponse)
async def create_new_auth_key(key_data: AuthKeyCreate, db: Session = Depends(get_db)):
    """Create new auth key with full Tailscale integration"""
    
    try:
        logger.info(f"Creating new auth key: {key_data.description}")
        
        # Validate user_id if provided
        if key_data.user_id:
            user = db.query(User).filter(User.id == key_data.user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            logger.info(f"Key will be restricted to user: {user.email}")
        
        # Validate machine_id if provided
        if key_data.machine_id:
            machine = db.query(Machine).filter(Machine.id == key_data.machine_id).first()
            if not machine:
                raise HTTPException(status_code=404, detail="Machine not found")
            logger.info(f"Key will be restricted to machine: {machine.hostname}")
        
        # Create key via Tailscale API
        try:
            ts_response = await create_auth_key(
                description=key_data.description,
                ttl_seconds=key_data.ttl_seconds,
                reusable=key_data.reusable,
                ephemeral=key_data.ephemeral,
                preauthorized=key_data.preauthorized,
                tags=key_data.tags,
                user_id=key_data.user_id,
                machine_id=key_data.machine_id
            )
            logger.info(f"Successfully created Tailscale key: {ts_response.get('id', 'unknown')}")
        except Exception as e:
            logger.error(f"Failed to create Tailscale key: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create key in Tailscale: {str(e)}")
        
        # Calculate expiry
        expires_at = datetime.utcnow() + timedelta(seconds=key_data.ttl_seconds)
        
        # Store in database
        new_key = AuthKey(
            ts_key_id=ts_response["id"],
            user_id=key_data.user_id,
            machine_id=key_data.machine_id,
            description=key_data.description,
            key_encrypted=ts_response["key"],  # TODO: Encrypt this
            authkey_ciphertext=ts_response["key"],  # Set this for backward compatibility
            key_masked=ts_response["key"][:20] + "..." + ts_response["key"][-4:],
            masked=ts_response["key"][:20] + "..." + ts_response["key"][-4:],
            reusable=key_data.reusable,
            ephemeral=key_data.ephemeral,
            preauthorized=key_data.preauthorized,
            tags=json.dumps(key_data.tags) if key_data.tags else None,
            ttl_seconds=key_data.ttl_seconds,
            expires_at=expires_at,
            active=True,
            revoked=False,
            uses=0
        )
        
        db.add(new_key)
        db.commit()
        db.refresh(new_key)
        logger.info(f"Successfully stored key in database: {new_key.id}")
        
        # Get user and machine info for response
        user = db.query(User).filter(User.id == key_data.user_id).first() if key_data.user_id else None
        machine = db.query(Machine).filter(Machine.id == key_data.machine_id).first() if key_data.machine_id else None
        
        # Get permissions
        permissions = {}
        try:
            permissions = await validate_key_permissions(ts_response["id"])
        except Exception as e:
            logger.warning(f"Failed to get key permissions: {e}")
        
        response = AuthKeyResponse(
            id=new_key.id,
            ts_key_id=new_key.ts_key_id,
            description=new_key.description,
            key=ts_response["key"],  # Full key only on creation
            key_masked=new_key.key_masked,
            status="active",
            expires_at=new_key.expires_at.isoformat(),
            uses=0,
            max_uses=ts_response.get("maxUses"),
            created_at=new_key.created_at.isoformat(),
            tags=key_data.tags,
            reusable=key_data.reusable,
            ephemeral=key_data.ephemeral,
            preauthorized=key_data.preauthorized,
            user_email=user.email if user else None,
            machine_hostname=machine.hostname if machine else None,
            permissions=permissions
        )
        
        logger.info(f"Successfully created auth key: {response.id}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create auth key: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create auth key: {str(e)}")

@router.get("/{key_id}", response_model=AuthKeyResponse)
async def get_auth_key(key_id: str, db: Session = Depends(get_db)):
    """Get detailed information about a specific auth key"""
    try:
        key = db.query(AuthKey).filter(AuthKey.id == key_id).first()
        if not key:
            raise HTTPException(status_code=404, detail="Auth key not found")
        
        # Get user and machine info
        user = db.query(User).filter(User.id == key.user_id).first() if key.user_id else None
        machine = db.query(Machine).filter(Machine.id == key.machine_id).first() if key.machine_id else None
        
        # Get Tailscale details
        permissions = {}
        if key.ts_key_id:
            try:
                permissions = await validate_key_permissions(key.ts_key_id)
            except Exception as e:
                logger.warning(f"Failed to get key permissions: {e}")
        
        # Determine status
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        expires_at = key.expires_at
        
        # Handle different datetime formats
        if isinstance(expires_at, str):
            try:
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            except ValueError:
                # Fallback for other date formats
                expires_at = datetime.fromisoformat(expires_at)
        elif expires_at and hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is None:
            # If datetime is naive, assume UTC
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        # Ensure expires_at has timezone info
        if expires_at and hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if key.revoked:
            status = "revoked"
        elif expires_at and expires_at < now:
            status = "expired"
        else:
            status = "active"
        
        return AuthKeyResponse(
            id=key.id,
            ts_key_id=key.ts_key_id or "",
            description=key.description or "",
            key_masked=key.key_masked or key.masked or "Unknown",
            status=status,
            expires_at=key.expires_at.isoformat() if hasattr(key.expires_at, 'isoformat') else str(key.expires_at),
            uses=key.uses or 0,
            max_uses=None,  # Would need to fetch from Tailscale
            created_at=key.created_at.isoformat() if hasattr(key.created_at, 'isoformat') else str(key.created_at),
            tags=json.loads(key.tags) if key.tags and isinstance(key.tags, str) else (key.tags or []),
            reusable=key.reusable,
            ephemeral=key.ephemeral,
            preauthorized=key.preauthorized,
            user_email=user.email if user else None,
            machine_hostname=machine.hostname if machine else None,
            permissions=permissions
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get auth key: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get auth key: {str(e)}")

@router.put("/{key_id}", response_model=AuthKeyResponse)
async def update_auth_key(key_id: str, updates: AuthKeyUpdate, db: Session = Depends(get_db)):
    """Update an existing auth key"""
    try:
        key = db.query(AuthKey).filter(AuthKey.id == key_id).first()
        if not key:
            raise HTTPException(status_code=404, detail="Auth key not found")
        
        # Update fields
        if updates.description is not None:
            key.description = updates.description
        
        if updates.tags is not None:
            key.tags = json.dumps(updates.tags) if updates.tags else None
        
        if updates.active is not None:
            key.active = updates.active
        
        db.commit()
        db.refresh(key)
        
        # Return updated key
        return await get_auth_key(key_id, db)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update auth key: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update auth key: {str(e)}")

@router.post("/{key_id}/revoke")
async def revoke_key(key_id: str, db: Session = Depends(get_db)):
    """Revoke an auth key"""
    try:
        key = db.query(AuthKey).filter(AuthKey.id == key_id).first()
        if not key:
            raise HTTPException(status_code=404, detail="Auth key not found")
        
        if key.revoked:
            raise HTTPException(status_code=400, detail="Auth key is already revoked")
        
        # Revoke via Tailscale API if ts_key_id exists
        if key.ts_key_id:
            try:
                await revoke_auth_key(key.ts_key_id)
                logger.info(f"Successfully revoked key {key_id} in Tailscale")
            except Exception as e:
                logger.warning(f"Failed to revoke key {key_id} in Tailscale: {e}")
                # Continue with database update
        
        # Update database
        key.revoked = True
        key.revoked_at = datetime.utcnow()
        key.active = False
        db.commit()
        
        logger.info(f"Successfully revoked key {key_id} in database")
        return {"message": "Auth key revoked successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to revoke auth key: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to revoke auth key: {str(e)}")

@router.post("/{key_id}/reactivate")
async def reactivate_key(key_id: str, db: Session = Depends(get_db)):
    """Reactivate a revoked auth key (only if not expired)"""
    try:
        key = db.query(AuthKey).filter(AuthKey.id == key_id).first()
        if not key:
            raise HTTPException(status_code=404, detail="Auth key not found")
        
        if not key.revoked:
            raise HTTPException(status_code=400, detail="Auth key is not revoked")
        
        # Check if expired
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        expires_at = key.expires_at
        
        # Handle different datetime formats
        if isinstance(expires_at, str):
            try:
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            except ValueError:
                # Fallback for other date formats
                expires_at = datetime.fromisoformat(expires_at)
        elif expires_at and hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is None:
            # If datetime is naive, assume UTC
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        # Ensure expires_at has timezone info
        if expires_at and hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < now:
            raise HTTPException(status_code=400, detail="Cannot reactivate expired key")
        
        # Reactivate in database
        key.revoked = False
        key.revoked_at = None
        key.active = True
        db.commit()
        
        logger.info(f"Successfully reactivated key {key_id}")
        return {"message": "Auth key reactivated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reactivate auth key: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reactivate auth key: {str(e)}")

@router.get("/{key_id}/usage")
async def get_key_usage(key_id: str, db: Session = Depends(get_db)):
    """Get usage statistics for a specific auth key"""
    try:
        key = db.query(AuthKey).filter(AuthKey.id == key_id).first()
        if not key:
            raise HTTPException(status_code=404, detail="Auth key not found")
        
        if not key.ts_key_id:
            return {"error": "No Tailscale key ID associated"}
        
        # Get usage from Tailscale
        usage_stats = await get_key_usage_stats(key.ts_key_id)
        
        # Combine with database stats
        result = {
            "database_uses": key.uses or 0,
            "tailscale_uses": usage_stats.get("uses", 0),
            "last_used": usage_stats.get("last_used"),
            "created": usage_stats.get("created"),
            "expires": usage_stats.get("expires"),
            "max_uses": usage_stats.get("max_uses")
        }
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to get key usage: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get key usage: {str(e)}")

@router.get("/health/check")
async def check_tailscale_health():
    """Check Tailscale API health and connectivity"""
    try:
        health_info = await health_check()
        logger.info(f"Tailscale health check: {health_info}")
        return health_info
    except Exception as e:
        logger.error(f"Tailscale health check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "last_check": datetime.utcnow().isoformat()
        }