from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from typing import Dict, List
from ..db import get_db
from ..models import User, Device, AuthKey, AuditLog

router = APIRouter()

@router.get("/overview")
async def get_analytics_overview(db: Session = Depends(get_db)):
    """Get system overview analytics"""
    
    # Count active users (logged in last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_users = db.query(User).filter(
        User.last_login >= thirty_days_ago
    ).count()
    
    total_users = db.query(User).count()
    
    # Device statistics
    online_devices = db.query(Device).filter(Device.status == 'online').count()
    total_devices = db.query(Device).count()
    
    # Auth key statistics
    active_keys = db.query(AuthKey).filter(
        AuthKey.status == 'active',
        AuthKey.expires_at > datetime.utcnow()
    ).count()
    
    # System health
    uptime_avg = 98.5  # Calculate from device uptime data
    
    return {
        "totalUsers": total_users,
        "activeUsers": active_users,
        "onlineDevices": online_devices,
        "totalDevices": total_devices,
        "activeKeys": active_keys,
        "uptimeAvg": uptime_avg,
        "alertsToday": 3,  # Calculate from logs
        "deploymentsToday": 7  # Calculate from deployment logs
    }

@router.get("/network-usage")
async def get_network_usage(days: int = 7, db: Session = Depends(get_db)):
    """Get network usage statistics"""
    
    # This would normally query from network monitoring data
    # For now, return mock data structure
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    usage_data = []
    for i in range(days):
        date = start_date + timedelta(days=i)
        usage_data.append({
            "date": date.isoformat(),
            "upload": 1024 * 1024 * 1024 * (0.5 + i * 0.1),  # GB
            "download": 1024 * 1024 * 1024 * (2.0 + i * 0.2),  # GB
            "total": 1024 * 1024 * 1024 * (2.5 + i * 0.3)  # GB
        })
    
    return {"data": usage_data}

@router.get("/device-performance")
async def get_device_performance(db: Session = Depends(get_db)):
    """Get device performance metrics"""
    
    devices = db.query(Device).all()
    performance_data = []
    
    for device in devices:
        # This would normally come from agent telemetry
        performance_data.append({
            "deviceId": device.id,
            "name": device.name,
            "ip": device.ip,
            "status": device.status,
            "ping": 45 if device.status == 'online' else None,
            "uptime": 99.2 if device.status == 'online' else 0,
            "lastUpdate": device.last_seen.isoformat() if device.last_seen else None
        })
    
    return {"devices": performance_data}