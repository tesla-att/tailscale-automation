from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from ..models import User, Machine, PortForward, Event
from ..schemas import CreatePortForwardReq, PortForwardOut, UpdatePortForwardReq
from ..services.portforward import PortForwardManager
from ..utils.logging import get_logger

router = APIRouter()
log = get_logger(__name__)

@router.get("", response_model=List[PortForwardOut])
async def list_port_forwards(db: Session = Depends(get_db)):
    """List all port forwarding rules"""
    forwards = db.query(PortForward).all()
    return [
        PortForwardOut(
            id=pf.id,
            name=pf.name,
            source_port=pf.source_port,
            target_host=pf.target_host,
            target_port=pf.target_port,
            protocol=pf.protocol,
            active=pf.active,
            description=pf.description,
            created_at=pf.created_at,
            user_id=pf.user_id,
            machine_id=pf.machine_id
        )
        for pf in forwards
    ]

@router.post("", response_model=PortForwardOut)
async def create_port_forward(body: CreatePortForwardReq, db: Session = Depends(get_db)):
    """Create a new port forwarding rule"""
    # Validate user exists
    user = db.get(User, body.user_id)
    if not user:
        raise HTTPException(404, "User not found")
    
    # Validate machine exists if provided
    machine = None
    if body.machine_id:
        machine = db.get(Machine, body.machine_id)
        if not machine:
            raise HTTPException(404, "Machine not found")
    
    # Check if source port is already in use
    existing = db.query(PortForward).filter(
        PortForward.source_port == body.source_port,
        PortForward.protocol == body.protocol,
        PortForward.active == True
    ).first()
    
    if existing:
        raise HTTPException(400, f"Port {body.source_port} ({body.protocol}) is already in use")
    
    # Create the port forward rule in the system
    success = await PortForwardManager.create_port_forward(
        body.source_port, 
        body.target_host, 
        body.target_port, 
        body.protocol
    )
    
    if not success:
        raise HTTPException(500, "Failed to create port forwarding rule in system")
    
    # Create database record
    port_forward = PortForward(
        user_id=body.user_id,
        machine_id=body.machine_id,
        name=body.name,
        source_port=body.source_port,
        target_host=body.target_host,
        target_port=body.target_port,
        protocol=body.protocol,
        description=body.description,
        active=True
    )
    
    db.add(port_forward)
    
    # Log event
    event = Event(
        user_id=body.user_id,
        machine_id=body.machine_id,
        type="PORT_FORWARD_CREATED",
        message=f"Created port forward: {body.source_port} -> {body.target_host}:{body.target_port}"
    )
    db.add(event)
    
    db.commit()
    db.refresh(port_forward)
    
    log.info(f"Created port forward: {port_forward.name} ({port_forward.id})")
    
    return PortForwardOut(
        id=port_forward.id,
        name=port_forward.name,
        source_port=port_forward.source_port,
        target_host=port_forward.target_host,
        target_port=port_forward.target_port,
        protocol=port_forward.protocol,
        active=port_forward.active,
        description=port_forward.description,
        created_at=port_forward.created_at,
        user_id=port_forward.user_id,
        machine_id=port_forward.machine_id
    )

@router.get("/{id}", response_model=PortForwardOut)
async def get_port_forward(id: str, db: Session = Depends(get_db)):
    """Get a specific port forwarding rule"""
    port_forward = db.get(PortForward, id)
    if not port_forward:
        raise HTTPException(404, "Port forward not found")
    
    return PortForwardOut(
        id=port_forward.id,
        name=port_forward.name,
        source_port=port_forward.source_port,
        target_host=port_forward.target_host,
        target_port=port_forward.target_port,
        protocol=port_forward.protocol,
        active=port_forward.active,
        description=port_forward.description,
        created_at=port_forward.created_at,
        user_id=port_forward.user_id,
        machine_id=port_forward.machine_id
    )

@router.put("/{id}", response_model=PortForwardOut)
async def update_port_forward(id: str, body: UpdatePortForwardReq, db: Session = Depends(get_db)):
    """Update a port forwarding rule"""
    port_forward = db.get(PortForward, id)
    if not port_forward:
        raise HTTPException(404, "Port forward not found")
    
    old_active = port_forward.active
    old_target_host = port_forward.target_host
    old_target_port = port_forward.target_port
    
    # Update fields
    if body.name is not None:
        port_forward.name = body.name
    if body.target_host is not None:
        port_forward.target_host = body.target_host
    if body.target_port is not None:
        port_forward.target_port = body.target_port
    if body.description is not None:
        port_forward.description = body.description
    if body.active is not None:
        port_forward.active = body.active
    
    # Handle system-level changes
    if body.active is not None and body.active != old_active:
        if body.active:
            # Enable the rule
            success = await PortForwardManager.enable_port_forward(
                port_forward.source_port,
                port_forward.target_host,
                port_forward.target_port,
                port_forward.protocol
            )
            if not success:
                raise HTTPException(500, "Failed to enable port forwarding rule")
        else:
            # Disable the rule
            success = await PortForwardManager.disable_port_forward(
                port_forward.source_port,
                old_target_host,
                old_target_port,
                port_forward.protocol
            )
            if not success:
                log.warning(f"Failed to disable port forwarding rule for {port_forward.id}")
    
    # If target changed and rule is active, update the system rule
    elif port_forward.active and (body.target_host is not None or body.target_port is not None):
        # Remove old rule
        await PortForwardManager.disable_port_forward(
            port_forward.source_port,
            old_target_host,
            old_target_port,
            port_forward.protocol
        )
        # Add new rule
        success = await PortForwardManager.enable_port_forward(
            port_forward.source_port,
            port_forward.target_host,
            port_forward.target_port,
            port_forward.protocol
        )
        if not success:
            # Rollback changes
            port_forward.target_host = old_target_host
            port_forward.target_port = old_target_port
            await PortForwardManager.enable_port_forward(
                port_forward.source_port,
                old_target_host,
                old_target_port,
                port_forward.protocol
            )
            raise HTTPException(500, "Failed to update port forwarding rule")
    
    # Log event
    event = Event(
        user_id=port_forward.user_id,
        machine_id=port_forward.machine_id,
        type="PORT_FORWARD_UPDATED",
        message=f"Updated port forward: {port_forward.name}"
    )
    db.add(event)
    
    db.commit()
    db.refresh(port_forward)
    
    log.info(f"Updated port forward: {port_forward.name} ({port_forward.id})")
    
    return PortForwardOut(
        id=port_forward.id,
        name=port_forward.name,
        source_port=port_forward.source_port,
        target_host=port_forward.target_host,
        target_port=port_forward.target_port,
        protocol=port_forward.protocol,
        active=port_forward.active,
        description=port_forward.description,
        created_at=port_forward.created_at,
        user_id=port_forward.user_id,
        machine_id=port_forward.machine_id
    )

@router.delete("/{id}")
async def delete_port_forward(id: str, db: Session = Depends(get_db)):
    """Delete a port forwarding rule"""
    port_forward = db.get(PortForward, id)
    if not port_forward:
        raise HTTPException(404, "Port forward not found")
    
    # Remove from system if active
    if port_forward.active:
        success = await PortForwardManager.delete_port_forward(
            port_forward.source_port,
            port_forward.target_host,
            port_forward.target_port,
            port_forward.protocol
        )
        if not success:
            log.warning(f"Failed to remove port forwarding rule from system for {port_forward.id}")
    
    # Log event
    event = Event(
        user_id=port_forward.user_id,
        machine_id=port_forward.machine_id,
        type="PORT_FORWARD_DELETED",
        message=f"Deleted port forward: {port_forward.name}"
    )
    db.add(event)
    
    # Delete from database
    db.delete(port_forward)
    db.commit()
    
    log.info(f"Deleted port forward: {port_forward.name} ({id})")
    
    return {"ok": True}

@router.post("/{id}/toggle")
async def toggle_port_forward(id: str, db: Session = Depends(get_db)):
    """Toggle a port forwarding rule on/off"""
    port_forward = db.get(PortForward, id)
    if not port_forward:
        raise HTTPException(404, "Port forward not found")
    
    new_state = not port_forward.active
    
    if new_state:
        # Enable the rule
        success = await PortForwardManager.enable_port_forward(
            port_forward.source_port,
            port_forward.target_host,
            port_forward.target_port,
            port_forward.protocol
        )
    else:
        # Disable the rule
        success = await PortForwardManager.disable_port_forward(
            port_forward.source_port,
            port_forward.target_host,
            port_forward.target_port,
            port_forward.protocol
        )
    
    if not success:
        action = "enable" if new_state else "disable"
        raise HTTPException(500, f"Failed to {action} port forwarding rule")
    
    port_forward.active = new_state
    
    # Log event
    event = Event(
        user_id=port_forward.user_id,
        machine_id=port_forward.machine_id,
        type="PORT_FORWARD_TOGGLED",
        message=f"{'Enabled' if new_state else 'Disabled'} port forward: {port_forward.name}"
    )
    db.add(event)
    
    db.commit()
    
    log.info(f"{'Enabled' if new_state else 'Disabled'} port forward: {port_forward.name} ({id})")
    
    return {"ok": True, "active": new_state}

@router.get("/system/status")
async def get_system_status():
    """Get system port forwarding status"""
    iptables_available = await PortForwardManager.check_iptables_available()
    active_rules = await PortForwardManager.list_port_forwards()
    
    return {
        "iptables_available": iptables_available,
        "active_system_rules": len(active_rules),
        "system_rules": active_rules
    }
