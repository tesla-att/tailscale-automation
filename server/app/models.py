from sqlalchemy.orm import relationship
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, TIMESTAMP, text, Text
from uuid import uuid4
from .db import Base

def pk(): return str(uuid4())

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=pk)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=True)  # Used by routers instead of display_name
    display_name = Column(String, nullable=True)  # Keep for backward compatibility
    is_active = Column(Boolean, default=True)
    last_login = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    machines = relationship("Machine", back_populates="user")
    keys = relationship("AuthKey", back_populates="user")
    port_forwards = relationship("PortForward", back_populates="user")

class Machine(Base):
    __tablename__ = "machines"
    id = Column(String, primary_key=True, default=pk)
    user_id = Column(String, ForeignKey("users.id"))
    hostname = Column(String, nullable=True)
    ts_device_id = Column(String, nullable=True)
    last_seen = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    user = relationship("User", back_populates="machines")
    keys = relationship("AuthKey", back_populates="machine")
    port_forwards = relationship("PortForward", back_populates="machine")

class AuthKey(Base):
    __tablename__ = "auth_keys"
    id = Column(String, primary_key=True, default=pk)
    user_id = Column(String, ForeignKey("users.id"))
    machine_id = Column(String, ForeignKey("machines.id"), nullable=True)

    ts_key_id = Column(String, nullable=True)              # id của key trong Tailscale
    description = Column(String, nullable=True)            # description field expected by routers
    key_encrypted = Column(Text, nullable=True)            # lưu mã hoá (Fernet) - used by routers
    authkey_ciphertext = Column(Text, nullable=False)      # lưu mã hoá (Fernet) - keep for backward compatibility
    key_masked = Column(String, nullable=True)             # ví dụ ...abcd12 - used by routers
    masked = Column(String, nullable=False)                # ví dụ ...abcd12 - keep for backward compatibility
    reusable = Column(Boolean, default=True)
    ephemeral = Column(Boolean, default=False)
    preauthorized = Column(Boolean, default=True)
    tags = Column(Text, nullable=True)                     # JSON text
    ttl_seconds = Column(Integer, nullable=False)
    active = Column(Boolean, default=True)
    revoked = Column(Boolean, default=False)               # Expected by routers
    revoked_at = Column(TIMESTAMP(timezone=True), nullable=True)  # Expected by routers
    uses = Column(Integer, default=0, nullable=True)       # Expected by routers
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    expires_at = Column(TIMESTAMP(timezone=True), nullable=True)

    user = relationship("User", back_populates="keys")
    machine = relationship("Machine", back_populates="keys")

class PortForward(Base):
    __tablename__ = "port_forwards"
    id = Column(String, primary_key=True, default=pk)
    user_id = Column(String, ForeignKey("users.id"))
    machine_id = Column(String, ForeignKey("machines.id"), nullable=True)
    
    name = Column(String, nullable=False)                  # Friendly name for the rule
    source_port = Column(Integer, nullable=False)
    target_host = Column(String, nullable=False)           # Target IP or hostname
    target_port = Column(Integer, nullable=False)
    protocol = Column(String, default="tcp")               # tcp or udp
    active = Column(Boolean, default=True)
    description = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    
    user = relationship("User", back_populates="port_forwards")
    machine = relationship("Machine", back_populates="port_forwards")

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=True)
    machine_id = Column(String, nullable=True)
    type = Column(String, nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))

class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, default=pk)
    ts_device_id = Column(String, unique=True, nullable=True)
    name = Column(String, nullable=False)
    hostname = Column(String, nullable=True)
    ip = Column(String, nullable=True)
    os = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="offline")  # online, offline
    last_seen = Column(TIMESTAMP(timezone=True), nullable=True)
    tags = Column(Text, nullable=True)  # JSON text
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=pk)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    resource = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    timestamp = Column(TIMESTAMP(timezone=True), server_default=text("now()"))

class DeploymentLog(Base):
    __tablename__ = "deployment_logs"
    id = Column(String, primary_key=True, default=pk)
    action = Column(String, nullable=False)
    status = Column(String, nullable=False)  # building, completed, failed
    details = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))

class SystemMetrics(Base):
    __tablename__ = "system_metrics"
    id = Column(String, primary_key=True, default=pk)
    metric_name = Column(String, nullable=False)
    metric_value = Column(String, nullable=True)
    metadata = Column(Text, nullable=True)  # JSON text
    timestamp = Column(TIMESTAMP(timezone=True), server_default=text("now()"))