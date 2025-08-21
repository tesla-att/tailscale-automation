from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import json
from datetime import datetime

router = APIRouter()

class WindowsDevice(BaseModel):
    hostname: str
    ip_address: str
    os_version: str
    architecture: str
    domain: Optional[str] = None
    status: str = "pending"

class DeploymentConfig(BaseModel):
    auth_key: str
    tags: List[str] = ["tag:windows", "tag:managed"]
    auto_update: bool = True
    unattended_mode: bool = True
    advertise_routes: List[str] = []
    accept_routes: bool = True

class BulkDeploymentRequest(BaseModel):
    devices: List[str]  # hostnames
    config: DeploymentConfig

# In-memory storage - replace with database
deployments_db = []

@router.get("/discover-devices")
async def discover_windows_devices():
    """Discover Windows devices on the network"""
    # Mock discovered devices - replace with actual network discovery
    return [
        {
            "hostname": "WIN-DESKTOP-001",
            "ip_address": "192.168.1.100",
            "os_version": "Windows 11 Pro",
            "architecture": "x64",
            "domain": "company.local",
            "status": "discovered"
        },
        {
            "hostname": "WIN-LAPTOP-002", 
            "ip_address": "192.168.1.101",
            "os_version": "Windows 10 Pro",
            "architecture": "x64",
            "domain": "company.local",
            "status": "discovered"
        },
        {
            "hostname": "WIN-SERVER-003",
            "ip_address": "192.168.1.102", 
            "os_version": "Windows Server 2022",
            "architecture": "x64",
            "domain": "company.local",
            "status": "discovered"
        }
    ]

@router.post("/generate-script")
async def generate_deployment_script(config: DeploymentConfig):
    """Generate PowerShell deployment script"""
    
    powershell_script = f'''
# Tailscale Windows Deployment Script
# Generated: {datetime.now().isoformat()}

param(
    [string]$LogPath = "$env:TEMP\\tailscale-install.log"
)

function Write-Log {{
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Output $logMessage
    Add-Content -Path $LogPath -Value $logMessage
}}

try {{
    Write-Log "Starting Tailscale deployment..."
    
    # Download Tailscale MSI
    $MsiUrl = "https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi"
    $MsiPath = "$env:TEMP\\tailscale-setup.msi"
    
    Write-Log "Downloading Tailscale installer..."
    Invoke-WebRequest -Uri $MsiUrl -OutFile $MsiPath -UseBasicParsing
    
    # Install Tailscale
    Write-Log "Installing Tailscale..."
    $InstallArgs = @(
        "/i", $MsiPath,
        "/quiet",
        "/norestart"
    )
    
    if ({str(config.unattended_mode).lower()}) {{
        $InstallArgs += "TS_UNATTENDEDMODE=always"
    }}
    
    if ({str(config.auto_update).lower()}) {{
        $InstallArgs += "TS_INSTALLUPDATES=always"
    }}
    
    $process = Start-Process "msiexec.exe" -ArgumentList $InstallArgs -Wait -PassThru
    
    if ($process.ExitCode -ne 0) {{
        throw "Installation failed with exit code $($process.ExitCode)"
    }}
    
    Write-Log "Tailscale installed successfully"
    
    # Authenticate and configure
    Write-Log "Configuring Tailscale..."
    
    $TailscaleCmd = "C:\\Program Files\\Tailscale\\tailscale.exe"
    $AuthArgs = @("up", "--auth-key={config.auth_key}")
    
    if ({len(config.tags)} -gt 0) {{
        $AuthArgs += "--advertise-tags={','.join(config.tags)}"
    }}
    
    if ({len(config.advertise_routes)} -gt 0) {{
        $AuthArgs += "--advertise-routes={','.join(config.advertise_routes)}"
    }}
    
    if ({str(config.accept_routes).lower()}) {{
        $AuthArgs += "--accept-routes"
    }}
    
    & $TailscaleCmd $AuthArgs
    
    if ($LASTEXITCODE -ne 0) {{
        throw "Tailscale authentication failed"
    }}
    
    Write-Log "Tailscale configured successfully"
    
    # Verify installation
    $Status = & $TailscaleCmd status --json | ConvertFrom-Json
    Write-Log "Device IP: $($Status.Self.TailscaleIPs[0])"
    Write-Log "Deployment completed successfully"
    
    return @{{
        success = $true
        device_ip = $Status.Self.TailscaleIPs[0]
        message = "Tailscale deployed successfully"
    }}
    
}} catch {{
    $errorMsg = "Deployment failed: $($_.Exception.Message)"
    Write-Log $errorMsg
    Write-Error $errorMsg
    return @{{
        success = $false
        error = $errorMsg
    }}
}}
'''
    
    return {
        "script": powershell_script,
        "filename": f"tailscale-deploy-{datetime.now().strftime('%Y%m%d-%H%M%S')}.ps1"
    }

@router.post("/deploy-bulk")
async def deploy_bulk(request: BulkDeploymentRequest, background_tasks: BackgroundTasks):
    """Deploy Tailscale to multiple Windows devices"""
    
    deployment_id = f"deploy-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    
    deployment = {
        "id": deployment_id,
        "devices": request.devices,
        "config": request.config.dict(),
        "status": "started",
        "started_at": datetime.now().isoformat(),
        "results": []
    }
    
    deployments_db.append(deployment)
    
    # Start background deployment task
    background_tasks.add_task(execute_bulk_deployment, deployment_id, request)
    
    return {
        "deployment_id": deployment_id,
        "status": "started",
        "message": f"Bulk deployment started for {len(request.devices)} devices"
    }

async def execute_bulk_deployment(deployment_id: str, request: BulkDeploymentRequest):
    """Background task to execute deployment"""
    deployment = next((d for d in deployments_db if d["id"] == deployment_id), None)
    if not deployment:
        return
    
    for device in request.devices:
        try:
            # Simulate deployment process
            await asyncio.sleep(2)  # Simulate installation time
            
            result = {
                "device": device,
                "status": "success",
                "message": "Deployment completed successfully",
                "completed_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            result = {
                "device": device,
                "status": "failed", 
                "message": f"Deployment failed: {str(e)}",
                "completed_at": datetime.now().isoformat()
            }
        
        deployment["results"].append(result)
    
    deployment["status"] = "completed"
    deployment["completed_at"] = datetime.now().isoformat()

@router.get("/deployments")
async def get_deployments():
    """Get all deployment history"""
    return deployments_db

@router.get("/deployments/{deployment_id}")
async def get_deployment_status(deployment_id: str):
    """Get specific deployment status"""
    deployment = next((d for d in deployments_db if d["id"] == deployment_id), None)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment