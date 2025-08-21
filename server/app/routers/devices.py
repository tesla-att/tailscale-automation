from fastapi import APIRouter
from ..tailscale import list_devices
from ..websockets import notification_manager

router = APIRouter()

# @router.get("")
# async def devices():
#     return await list_devices()

@router.get("")
async def devices():
    devices = await list_devices()
    
    # Gửi notification về device status
    await notification_manager.broadcast_notification({
        "type": "device_status_update",
        "message": f"Device list updated - {len(devices)} devices online",
        "data": {"device_count": len(devices)}
    })
    
    return devices