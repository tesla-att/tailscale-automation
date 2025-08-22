from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Machine, User
from ..tailscale import list_devices
from ..websockets import notification_manager
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class MachineCreate(BaseModel):
    user_id: str
    hostname: str
    ts_device_id: str | None = None

@router.get("")
async def devices(db: Session = Depends(get_db)):
    """Get devices from both database and Tailscale"""
    try:
        # Get devices from database first
        db_machines = db.query(Machine).all()
        db_devices = []
        
        for machine in db_machines:
            user = db.query(User).filter(User.id == machine.user_id).first()
            db_devices.append({
                "id": machine.id,
                "hostname": machine.hostname,
                "ts_device_id": machine.ts_device_id,
                "user_email": user.email if user else None,
                "user_id": machine.user_id,
                "created_at": machine.created_at.isoformat() if machine.created_at else None,
                "status": "active"  # Default status for database machines
            })
        
        # Try to get devices from Tailscale API
        ts_devices = []
        try:
            ts_response = await list_devices()
            if isinstance(ts_response, dict) and "devices" in ts_response:
                ts_devices = ts_response["devices"]
            elif isinstance(ts_response, list):
                ts_devices = ts_response
            else:
                ts_devices = []
        except Exception as e:
            print(f"Warning: Failed to get devices from Tailscale: {e}")
            ts_devices = []
        
        # Combine and deduplicate devices
        all_devices = db_devices.copy()
        
        # Add Tailscale devices that aren't in database
        for ts_device in ts_devices:
            if not any(d["ts_device_id"] == ts_device.get("id") for d in all_devices):
                all_devices.append({
                    "id": ts_device.get("id"),
                    "hostname": ts_device.get("hostname", "Unknown"),
                    "ts_device_id": ts_device.get("id"),
                    "user_email": None,
                    "user_id": None,
                    "created_at": None,
                    "status": "online" if ts_device.get("lastSeen") else "offline"
                })
        
        # Send notification about device status
        try:
            await notification_manager.broadcast_notification({
                "type": "device_status_update",
                "message": f"Device list updated - {len(all_devices)} devices total",
                "data": {"device_count": len(all_devices)}
            })
        except Exception as e:
            print(f"Warning: Failed to send notification: {e}")
        
        return {"devices": all_devices, "total": len(all_devices)}
        
    except Exception as e:
        print(f"Error in devices endpoint: {e}")
        # Return database devices only if Tailscale fails
        try:
            db_machines = db.query(Machine).all()
            db_devices = []
            
            for machine in db_machines:
                user = db.query(User).filter(User.id == machine.user_id).first()
                db_devices.append({
                    "id": machine.id,
                    "hostname": machine.hostname,
                    "ts_device_id": machine.ts_device_id,
                    "user_email": user.email if user else None,
                    "user_id": machine.user_id,
                    "created_at": machine.created_at.isoformat() if machine.created_at else None,
                    "status": "active"
                })
            
            return {"devices": db_devices, "total": len(db_devices)}
        except Exception as db_error:
            print(f"Database error: {db_error}")
            raise HTTPException(status_code=500, detail=f"Failed to get devices: {str(e)}")

@router.post("")
async def create_machine(machine_data: MachineCreate, db: Session = Depends(get_db)):
    """Create new machine for user"""
    
    # Check if user exists
    user = db.query(User).filter(User.id == machine_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create new machine
    new_machine = Machine(
        user_id=machine_data.user_id,
        hostname=machine_data.hostname,
        ts_device_id=machine_data.ts_device_id,
        created_at=datetime.utcnow()
    )
    
    db.add(new_machine)
    db.commit()
    db.refresh(new_machine)
    
    return {
        "id": new_machine.id,
        "user_id": new_machine.user_id,
        "hostname": new_machine.hostname,
        "ts_device_id": new_machine.ts_device_id,
        "created_at": new_machine.created_at.isoformat()
    }