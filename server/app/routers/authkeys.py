from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from ..models import AuthKey
from ..tailscale import create_auth_key, revoke_auth_key
from pydantic import BaseModel
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/keys", tags=["authkeys"])

class AuthKeyCreate(BaseModel):
    description: str
    ttl_seconds: int
    reusable: bool = True
    tags: List[str] = []

class AuthKeyResponse(BaseModel):
    id: str
    description: str
    key: str
    status: str
    expiresAt: str
    uses: int
    maxUses: int
    created_at: str
    tags: List[str]

@router.get("", response_model=List[AuthKeyResponse])
async def list_auth_keys(db: Session = Depends(get_db)):
    """Get all auth keys"""
    keys = db.query(AuthKey).all()
    
    key_list = []
    for key in keys:
        # Determine status based on expiry
        now = datetime.utcnow()
        expires_at = datetime.fromisoformat(key.expires_at.replace('Z', '+00:00'))
        
        if key.revoked:
            status = "revoked"
        elif expires_at < now:
            status = "expired"
        else:
            status = "active"
        
        key_list.append(AuthKeyResponse(
            id=key.ts_key_id,
            description=key.description,
            key=key.key_masked,  # Use masked version for security
            status=status,
            expiresAt=key.expires_at,
            uses=key.uses or 0,
            maxUses=100,  # Default max uses
            created_at=key.created_at.isoformat(),
            tags=key.tags or []
        ))
    
    return key_list

@router.post("", response_model=AuthKeyResponse)
async def create_new_auth_key(key_data: AuthKeyCreate, db: Session = Depends(get_db)):
    """Create new auth key"""
    
    try:
        # Create key via Tailscale API
        ts_response = await create_auth_key(
            description=key_data.description,
            ttl_seconds=key_data.ttl_seconds,
            reusable=key_data.reusable,
            tags=key_data.tags
        )
        
        # Store in database
        expires_at = datetime.utcnow() + timedelta(seconds=key_data.ttl_seconds)
        
        new_key = AuthKey(
            ts_key_id=ts_response["id"],
            description=key_data.description,
            key_encrypted=ts_response["key"],  # Encrypt this
            key_masked=ts_response["key"][:20] + "...",
            expires_at=expires_at.isoformat(),
            tags=key_data.tags,
            created_at=datetime.utcnow()
        )
        
        db.add(new_key)
        db.commit()
        db.refresh(new_key)
        
        return AuthKeyResponse(
            id=new_key.ts_key_id,
            description=new_key.description,
            key=ts_response["key"],  # Return full key only on creation
            status="active",
            expiresAt=new_key.expires_at,
            uses=0,
            maxUses=100,
            created_at=new_key.created_at.isoformat(),
            tags=new_key.tags
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create auth key: {str(e)}")

@router.post("/{key_id}/revoke")
async def revoke_key(key_id: str, db: Session = Depends(get_db)):
    """Revoke an auth key"""
    
    # Find key in database
    key = db.query(AuthKey).filter(AuthKey.ts_key_id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="Auth key not found")
    
    try:
        # Revoke via Tailscale API
        await revoke_auth_key(key_id)
        
        # Update database
        key.revoked = True
        key.revoked_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Auth key revoked successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to revoke auth key: {str(e)}")