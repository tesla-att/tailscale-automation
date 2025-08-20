from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, AuthKey
from ..tailscale import list_devices
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/overview")
async def get_analytics_overview(db: Session = Depends(get_db)):
    """Get system overview analytics"""
    
    try:
        # Get device data from Tailscale
        device_data = await list_devices()
        devices = device_data.get("devices", [])
        
        # Count active devices (online in last hour)
        now = datetime.now(timezone.utc)
        one_hour_ago = now - timedelta(hours=1)
        
        online_devices = 0
        for device in devices:
            last_seen = datetime.fromisoformat(device.get("lastSeen", "").replace('Z', '+00:00'))
            if last_seen > one_hour_ago:
                online_devices += 1
        
        # User statistics
        total_users = db.query(User).count()
        active_users = db.query(User).filter(User.is_active == True).count()
        
        # Auth key statistics
        active_keys = db.query(AuthKey).filter(
            AuthKey.revoked == False,
            AuthKey.expires_at > now.isoformat()
        ).count()
        
        return {
            "totalUsers": total_users,
            "activeUsers": active_users,
            "activeDevices": online_devices,
            "totalDevices": len(devices),
            "activeKeys": active_keys,
            "avgUptime": 98.5,  # Calculate from device data
            "dataTransfer": "0 TB",  # Would need separate metrics
            "alertsToday": 0,  # Count from logs
            "deploymentsToday": 0  # Count from deployment logs
        }
        
    except Exception as e:
        # Return default values if Tailscale API fails
        return {
            "totalUsers": db.query(User).count(),
            "activeUsers": db.query(User).filter(User.is_active == True).count(),
            "activeDevices": 0,
            "totalDevices": 0,
            "activeKeys": db.query(AuthKey).filter(AuthKey.revoked == False).count(),
            "avgUptime": 0,
            "dataTransfer": "0 TB",
            "alertsToday": 0,
            "deploymentsToday": 0
        }