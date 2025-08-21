from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Dict, List
import subprocess
import os
import tempfile
from datetime import datetime
from ..db import get_db
from ..models import DeploymentLog, AuthKey
from ..utils.agent_builder import build_windows_agent
from ..websockets import notification_manager

router = APIRouter()

@router.post("/build-agent")
async def build_agent(
    config: Dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Build Windows agent with configuration"""
    
    try:
        # Get active auth key for agent
        auth_key = db.query(AuthKey).filter(
            AuthKey.status == 'active',
            AuthKey.expires_at > datetime.utcnow()
        ).first()
        
        if not auth_key:
            raise HTTPException(status_code=400, detail="No active auth key found")
        
        # Build configuration
        agent_config = {
            "auth_key_url": config.get("auth_key_url", "http://100.96.11.97:9090/authkey.txt"),
            "fallback_url": config.get("fallback_url", "https://auth.csonline-sri.work/authkey.txt"),
            "security_token": config.get("security_token", ""),
            "auto_start": config.get("auto_start", True),
            "auto_repair": config.get("auto_repair", True),
            "log_path": "C:\\ATT Tail Scale\\Logs\\tailscalelogs.log"
        }
        
        # Build agent in background
        background_tasks.add_task(build_agent_background, agent_config, db)
        
        return {"status": "building", "message": "Agent build started"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def build_agent_background(config: Dict, db: Session):
    """Background task to build agent"""
    try:
        # Create deployment log
        log = DeploymentLog(
            action="build_agent",
            status="building",
            details=f"Building agent with config: {config}",
            created_at=datetime.utcnow()
        )
        db.add(log)
        db.commit()
        
        # Build the agent (this would call PyInstaller)
        agent_path = await build_windows_agent(config)
        
        # Update log
        log.status = "completed"
        log.details = f"Agent built successfully: {agent_path}"
        db.commit()
        
        # Broadcast update
        await notification_manager.broadcast({
            "type": "deployment_update",
            "data": {
                "action": "build_agent",
                "status": "completed",
                "message": "Agent build completed successfully"
            }
        })
        
    except Exception as e:
        log.status = "failed"
        log.details = f"Build failed: {str(e)}"
        db.commit()
        
        await notification_manager.broadcast({
            "type": "deployment_update",
            "data": {
                "action": "build_agent",
                "status": "failed",
                "message": f"Agent build failed: {str(e)}"
            }
        })

@router.get("/download-agent")
async def download_agent():
    """Download the latest built agent"""
    agent_path = "/tmp/tailscale-agent.exe"
    
    if not os.path.exists(agent_path):
        raise HTTPException(status_code=404, detail="Agent not found. Please build first.")
    
    return FileResponse(
        agent_path,
        media_type="application/octet-stream",
        filename="tailscale-agent.exe"
    )

@router.get("/deployment-history")
async def get_deployment_history(db: Session = Depends(get_db)):
    """Get deployment history"""
    
    logs = db.query(DeploymentLog).order_by(
        DeploymentLog.created_at.desc()
    ).limit(50).all()
    
    return {
        "deployments": [
            {
                "id": log.id,
                "action": log.action,
                "status": log.status,
                "details": log.details,
                "timestamp": log.created_at.isoformat()
            }
            for log in logs
        ]
    }