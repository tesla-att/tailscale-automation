from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from datetime import datetime, timezone

router = APIRouter()

@router.get("/")
async def get_alerts_root(db: Session = Depends(get_db)):
    """Get alerts root data"""
    # Return basic alert information
    return {
        "alerts": [],
        "total": 0,
        "critical": 0,
        "warning": 0,
        "info": 0,
        "lastUpdated": datetime.now(timezone.utc).isoformat()
    }
