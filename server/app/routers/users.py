from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models import User

router = APIRouter(prefix="/api/users", tags=["users"])

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@router.get("")
def list_users(db: Session=Depends(get_db)):
    return db.query(User).all()

@router.post("")
def create_user(email: str, display_name: str="", db: Session=Depends(get_db)):
    u = User(email=email, display_name=display_name)
    db.add(u); db.commit(); db.refresh(u)
    return u
