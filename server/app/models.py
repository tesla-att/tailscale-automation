from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Integer, ForeignKey, TIMESTAMP, text, Text, JSON
from uuid import uuid4
from .db import Base

def pk(): return str(uuid4())

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    display_name: Mapped[str | None]
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    machines: Mapped[list["Machine"]] = relationship(back_populates="user")
    keys: Mapped[list["AuthKey"]] = relationship(back_populates="user")
    port_forwards: Mapped[list["PortForward"]] = relationship(back_populates="user")

class Machine(Base):
    __tablename__ = "machines"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    hostname: Mapped[str | None]
    ts_device_id: Mapped[str | None]
    last_seen: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    user: Mapped[User] = relationship(back_populates="machines")
    keys: Mapped[list["AuthKey"]] = relationship(back_populates="machine")
    port_forwards: Mapped[list["PortForward"]] = relationship(back_populates="machine")

class AuthKey(Base):
    __tablename__ = "auth_keys"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    machine_id: Mapped[str | None] = mapped_column(ForeignKey("machines.id"), nullable=True)

    ts_key_id: Mapped[str | None]              # id của key trong Tailscale
    authkey_ciphertext: Mapped[str]            # lưu mã hoá (Fernet)
    masked: Mapped[str]                        # ví dụ ...abcd12
    reusable: Mapped[bool] = mapped_column(Boolean, default=True)
    ephemeral: Mapped[bool] = mapped_column(Boolean, default=False)
    preauthorized: Mapped[bool] = mapped_column(Boolean, default=True)
    tags: Mapped[str | None]                   # JSON text
    ttl_seconds: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    expires_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))

    user: Mapped[User] = relationship(back_populates="keys")
    machine: Mapped[Machine] = relationship(back_populates="keys")

class PortForward(Base):
    __tablename__ = "port_forwards"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    machine_id: Mapped[str | None] = mapped_column(ForeignKey("machines.id"), nullable=True)
    
    name: Mapped[str]                              # Friendly name for the rule
    source_port: Mapped[int] = mapped_column(Integer)
    target_host: Mapped[str]                       # Target IP or hostname
    target_port: Mapped[int] = mapped_column(Integer)
    protocol: Mapped[str] = mapped_column(String, default="tcp")  # tcp or udp
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None]
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    
    user: Mapped[User] = relationship(back_populates="port_forwards")
    machine: Mapped["Machine"] = relationship(back_populates="port_forwards")

class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str | None]
    machine_id: Mapped[str | None]
    type: Mapped[str]
    message: Mapped[str]
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    ts_device_id: Mapped[str | None] = mapped_column(String, unique=True)
    name: Mapped[str]
    hostname: Mapped[str | None]
    ip: Mapped[str | None]
    os: Mapped[str | None]
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String, default="offline")  # online, offline
    last_seen: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    tags: Mapped[str | None] = mapped_column(Text)  # JSON text
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str]
    resource: Mapped[str | None]
    resource_id: Mapped[str | None]
    details: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None]
    timestamp: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

class DeploymentLog(Base):
    __tablename__ = "deployment_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    action: Mapped[str]
    status: Mapped[str]  # building, completed, failed
    details: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

class SystemMetrics(Base):
    __tablename__ = "system_metrics"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    metric_name: Mapped[str]
    metric_value: Mapped[str | None]
    metadata: Mapped[str | None] = mapped_column(Text)  # JSON text
    timestamp: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
