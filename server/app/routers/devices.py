from fastapi import APIRouter
from ..tailscale import list_devices

router = APIRouter(prefix="/api/devices", tags=["devices"])

@router.get("")
async def devices():
    return await list_devices()
