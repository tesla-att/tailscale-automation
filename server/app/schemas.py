from pydantic import BaseModel, Field
from datetime import datetime

class CreateKeyReq(BaseModel):
    user_id: str
    machine_id: str | None = None
    description: str | None = None
    ttl_seconds: int = 60*60*24*30
    reusable: bool = True
    ephemeral: bool = False
    preauthorized: bool = True
    tags: list[str] = Field(default_factory=list)

class KeyOut(BaseModel):
    id: str
    masked: str
    expires_at: datetime | None
    active: bool

class AgentKeyOut(BaseModel):
    authkey: str

class DeviceOut(BaseModel):
    id: str
    hostname: str | None = None
    user: str | None = None

class CreatePortForwardReq(BaseModel):
    user_id: str
    machine_id: str | None = None
    name: str
    source_port: int = Field(gt=0, le=65535)
    target_host: str
    target_port: int = Field(gt=0, le=65535)
    protocol: str = Field(default="tcp", pattern="^(tcp|udp)$")
    description: str | None = None

class PortForwardOut(BaseModel):
    id: str
    name: str
    source_port: int
    target_host: str
    target_port: int
    protocol: str
    active: bool
    description: str | None
    created_at: datetime
    user_id: str
    machine_id: str | None

class UpdatePortForwardReq(BaseModel):
    name: str | None = None
    target_host: str | None = None
    target_port: int | None = Field(None, gt=0, le=65535)
    description: str | None = None
    active: bool | None = None
