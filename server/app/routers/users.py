from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from ..models import User
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/users", tags=["users"])

class UserCreate(BaseModel):
    name: str
    email: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    status: str
    lastLogin: str
    devices: int
    created_at: str

@router.get("", response_model=List[UserResponse])
async def list_users(db: Session = Depends(get_db)):
    """Get all users"""
    users = db.query(User).all()
    
    # Convert to response format
    user_list = []
    for user in users:
        user_list.append(UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            status="active" if user.is_active else "inactive",
            lastLogin=user.last_login.isoformat() if user.last_login else datetime.utcnow().isoformat(),
            devices=0,  # TODO: Count devices for this user
            created_at=user.created_at.isoformat() if user.created_at else datetime.utcnow().isoformat()
        ))
    
    return user_list

@router.post("", response_model=UserResponse)
async def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Create new user"""
    
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Create new user
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        is_active=True,
        created_at=datetime.utcnow(),
        last_login=datetime.utcnow()
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return UserResponse(
        id=new_user.id,
        name=new_user.name,
        email=new_user.email,
        status="active",
        lastLogin=new_user.last_login.isoformat(),
        devices=0,
        created_at=new_user.created_at.isoformat()
    )