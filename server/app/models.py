from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Integer, ForeignKey, TIMESTAMP, text, Text
from uuid import uuid4
from .db import Base

def pk(): return str(uuid4())

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)  # Used by routers instead of display_name
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)  # Keep for backward compatibility
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    machines: Mapped[list["Machine"]] = relationship(back_populates="user")
    keys: Mapped[list["AuthKey"]] = relationship(back_populates="user")
    port_forwards: Mapped[list["PortForward"]] = relationship(back_populates="user")

    def __repr__(self):
        return f"<User(id='{self.id}', email='{self.email}', name='{self.name}')>"

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "display_name": self.display_name,
            "is_active": self.is_active,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Machine(Base):
    __tablename__ = "machines"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    hostname: Mapped[str | None] = mapped_column(String, nullable=True)
    ts_device_id: Mapped[str | None] = mapped_column(String, nullable=True)
    last_seen: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    user: Mapped[User] = relationship(back_populates="machines")
    keys: Mapped[list["AuthKey"]] = relationship(back_populates="machine")
    port_forwards: Mapped[list["PortForward"]] = relationship(back_populates="machine")

    def __repr__(self):
        return f"<Machine(id='{self.id}', hostname='{self.hostname}', ts_device_id='{self.ts_device_id}')"

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "hostname": self.hostname,
            "ts_device_id": self.ts_device_id,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class AuthKey(Base):
    __tablename__ = "auth_keys"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    machine_id: Mapped[str | None] = mapped_column(ForeignKey("machines.id"), nullable=True)

    ts_key_id: Mapped[str | None] = mapped_column(String, nullable=True)              # id của key trong Tailscale
    description: Mapped[str | None] = mapped_column(String, nullable=True)            # description field expected by routers
    key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)            # lưu mã hoá (Fernet) - used by routers
    authkey_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)      # lưu mã hoá (Fernet) - keep for backward compatibility
    key_masked: Mapped[str | None] = mapped_column(String, nullable=True)             # ví dụ ...abcd12 - used by routers
    masked: Mapped[str] = mapped_column(String, nullable=False)                # ví dụ ...abcd12 - keep for backward compatibility
    reusable: Mapped[bool] = mapped_column(Boolean, default=True)
    ephemeral: Mapped[bool] = mapped_column(Boolean, default=False)
    preauthorized: Mapped[bool] = mapped_column(Boolean, default=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)                     # JSON text
    ttl_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)               # Expected by routers
    revoked_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)  # Expected by routers
    uses: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)       # Expected by routers
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    expires_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="keys")
    machine: Mapped["Machine"] = relationship(back_populates="keys")

    def __repr__(self):
        return f"<AuthKey(id='{self.id}', ts_key_id='{self.ts_key_id}', masked='{self.masked}')"

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "machine_id": self.machine_id,
            "ts_key_id": self.ts_key_id,
            "description": self.description,
            "masked": self.masked,
            "key_masked": self.key_masked,
            "reusable": self.reusable,
            "ephemeral": self.ephemeral,
            "preauthorized": self.preauthorized,
            "tags": self.tags,
            "ttl_seconds": self.ttl_seconds,
            "active": self.active,
            "revoked": self.revoked,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "uses": self.uses,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None
        }

class PortForward(Base):
    __tablename__ = "port_forwards"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    machine_id: Mapped[str | None] = mapped_column(ForeignKey("machines.id"), nullable=True)
    
    name: Mapped[str] = mapped_column(String, nullable=False)                  # Friendly name for the rule
    source_port: Mapped[int] = mapped_column(Integer, nullable=False)
    target_host: Mapped[str] = mapped_column(String, nullable=False)           # Target IP or hostname
    target_port: Mapped[int] = mapped_column(Integer, nullable=False)
    protocol: Mapped[str] = mapped_column(String, default="tcp")               # tcp or udp
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    
    user: Mapped[User] = relationship(back_populates="port_forwards")
    machine: Mapped["Machine"] = relationship(back_populates="port_forwards")

    def __repr__(self):
        return f"<PortForward(id='{self.id}', name='{self.name}', {self.source_port}->{self.target_host}:{self.target_port})"

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "machine_id": self.machine_id,
            "name": self.name,
            "source_port": self.source_port,
            "target_host": self.target_host,
            "target_port": self.target_port,
            "protocol": self.protocol,
            "active": self.active,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    machine_id: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    def __repr__(self):
        return f"<Event(id='{self.id}', type='{self.type}', message='{self.message[:50]}...')"

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "machine_id": self.machine_id,
            "type": self.type,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    ts_device_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    hostname: Mapped[str | None] = mapped_column(String, nullable=True)
    ip: Mapped[str | None] = mapped_column(String, nullable=True)
    os: Mapped[str | None] = mapped_column(String, nullable=True)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String, default="offline")  # online, offline
    last_seen: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON text
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    resource: Mapped[str | None] = mapped_column(String, nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String, nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

class DeploymentLog(Base):
    __tablename__ = "deployment_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    action: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)  # building, completed, failed
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

class SystemMetrics(Base):
    __tablename__ = "system_metrics"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=pk)
    metric_name: Mapped[str] = mapped_column(String, nullable=False)
    metric_value: Mapped[str | None] = mapped_column(String, nullable=True)
    meta_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON text
    timestamp: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))