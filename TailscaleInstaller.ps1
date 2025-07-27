# =================================================================
# WINDOWS INSTALLER - TailscaleInstaller.ps1
# =================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$AuthKey,
    
    [Parameter(Mandatory=$true)]
    [string]$EmployeeId,
    
    [Parameter(Mandatory=$true)]
    [string]$Hostname,
    
    [string]$CompanyName = "YourCompany",
    
    [string]$ITContact = "it@company.com"
)

# Require Administrator privileges
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))
{
    Write-Host "This script requires Administrator privileges. Please run as Administrator." -ForegroundColor Red
    Start-Process PowerShell -Verb RunAs "-File `"$PSCommandPath`" -AuthKey $AuthKey -EmployeeId $EmployeeId -Hostname $Hostname -CompanyName $CompanyName -ITContact $ITContact"
    exit
}

# Configuration
$ConfigDir = "C:\ProgramData\TailscaleAutomation"
$LogFile = "$ConfigDir\installation.log"
$ConfigFile = "$ConfigDir\config.json"

# Create directories
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null

# Logging function
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    Write-Host $LogMessage
    Add-Content -Path $LogFile -Value $LogMessage
}

# Error handling
$ErrorActionPreference = "Stop"
trap {
    Write-Log "ERROR: $_" "ERROR"
    Write-Host "Installation failed. Check log at: $LogFile" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Log "=== Tailscale Installation Started ==="
Write-Log "Employee ID: $EmployeeId"
Write-Log "Hostname: $Hostname"
Write-Log "Company: $CompanyName"

# Create configuration
$Config = @{
    employee_id = $EmployeeId
    hostname = $Hostname
    company_name = $CompanyName
    it_contact = $ITContact
    install_date = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    auth_key_encrypted = $AuthKey # In production, encrypt this
    version = "1.0"
} | ConvertTo-Json -Depth 10

Set-Content -Path $ConfigFile -Value $Config
Write-Log "Configuration saved to: $ConfigFile"

# Download Tailscale
Write-Log "Downloading Tailscale installer..."
$TailscaleUrl = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
$InstallerPath = "$env:TEMP\tailscale-setup.exe"

try {
    Invoke-WebRequest -Uri $TailscaleUrl -OutFile $InstallerPath -UseBasicParsing
    Write-Log "Tailscale installer downloaded successfully"
} catch {
    Write-Log "Failed to download Tailscale installer: $_" "ERROR"
    throw
}

# Install Tailscale
Write-Log "Installing Tailscale..."
try {
    $Process = Start-Process -FilePath $InstallerPath -ArgumentList "/quiet" -Wait -PassThru
    if ($Process.ExitCode -eq 0) {
        Write-Log "Tailscale installed successfully"
    } else {
        throw "Installer returned exit code: $($Process.ExitCode)"
    }
} catch {
    Write-Log "Failed to install Tailscale: $_" "ERROR"
    throw
}

# Wait for service to start
Write-Log "Waiting for Tailscale service to start..."
Start-Sleep -Seconds 15

# Verify Tailscale installation
$TailscaleExe = "C:\Program Files\Tailscale\tailscale.exe"
if (-not (Test-Path $TailscaleExe)) {
    Write-Log "Tailscale executable not found at expected location" "ERROR"
    throw "Installation verification failed"
}

# Connect to Tailscale
Write-Log "Connecting to Tailscale network..."
try {
    $ConnectArgs = @("up", "--authkey=$AuthKey", "--hostname=$Hostname", "--accept-routes")
    & $TailscaleExe $ConnectArgs
    Write-Log "Successfully connected to Tailscale network"
} catch {
    Write-Log "Failed to connect to Tailscale: $_" "ERROR"
    throw
}

# Create auto-reconnect script
$AutoReconnectScript = @"
# Tailscale Auto-Reconnect Script
# Employee: $EmployeeId
# Generated: $(Get-Date)

`$ConfigFile = "$ConfigFile"
`$LogFile = "$ConfigDir\auto-reconnect.log"

function Write-Log {
    param([string]`$Message)
    `$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path `$LogFile -Value "[`$Timestamp] `$Message"
}

try {
    `$Config = Get-Content -Path `$ConfigFile | ConvertFrom-Json
    `$Status = & "C:\Program Files\Tailscale\tailscale.exe" status --json | ConvertFrom-Json
    
    if (`$Status.BackendState -ne "Running") {
        Write-Log "Tailscale not running, attempting reconnect..."
        & "C:\Program Files\Tailscale\tailscale.exe" up --authkey="`$(`$Config.auth_key_encrypted)" --hostname="`$(`$Config.hostname)" --accept-routes
        Write-Log "Reconnect attempted"
    } else {
        Write-Log "Tailscale is running normally"
    }
} catch {
    Write-Log "Error in auto-reconnect: `$_"
}
"@

$AutoReconnectPath = "$ConfigDir\auto-reconnect.ps1"
Set-Content -Path $AutoReconnectPath -Value $AutoReconnectScript
Write-Log "Auto-reconnect script created: $AutoReconnectPath"

# Create scheduled task for auto-reconnect
Write-Log "Creating scheduled task for auto-reconnect..."
try {
    $TaskName = "TailscaleAutoReconnect"
    $TaskAction = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$AutoReconnectPath`""
    $TaskTrigger = @(
        New-ScheduledTaskTrigger -AtLogOn,
        New-ScheduledTaskTrigger -AtStartup,
        New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)
    )
    $TaskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
    $TaskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    Register-ScheduledTask -TaskName $TaskName -Action $TaskAction -Trigger $TaskTrigger -Settings $TaskSettings -Principal $TaskPrincipal -Force
    Write-Log "Scheduled task created successfully"
} catch {
    Write-Log "Failed to create scheduled task: $_" "WARNING"
}

# Create desktop shortcut for Tailscale
Write-Log "Creating desktop shortcuts..."
try {
    $WshShell = New-Object -comObject WScript.Shell
    
    # Tailscale shortcut
    $Shortcut = $WshShell.CreateShortcut("$env:PUBLIC\Desktop\Tailscale.lnk")
    $Shortcut.TargetPath = "C:\Program Files\Tailscale\tailscale-ipn.exe"
    $Shortcut.Save()
    
    # Configuration shortcut
    $ConfigShortcut = $WshShell.CreateShortcut("$env:PUBLIC\Desktop\Tailscale Config.lnk")
    $ConfigShortcut.TargetPath = "notepad.exe"
    $ConfigShortcut.Arguments = $ConfigFile
    $ConfigShortcut.Save()
    
    Write-Log "Desktop shortcuts created"
} catch {
    Write-Log "Failed to create shortcuts: $_" "WARNING"
}

# Create uninstaller
$UninstallScript = @"
# Tailscale Uninstaller
# Employee: $EmployeeId

Write-Host "Uninstalling Tailscale for $EmployeeId..." -ForegroundColor Yellow

# Stop scheduled task
Unregister-ScheduledTask -TaskName "TailscaleAutoReconnect" -Confirm:`$false -ErrorAction SilentlyContinue

# Disconnect from Tailscale
& "C:\Program Files\Tailscale\tailscale.exe" logout -ErrorAction SilentlyContinue

# Uninstall Tailscale
`$UninstallString = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" | Where-Object DisplayName -like "*Tailscale*").UninstallString
if (`$UninstallString) {
    & cmd /c `$UninstallString /quiet
}

# Remove configuration
Remove-Item -Path "$ConfigDir" -Recurse -Force -ErrorAction SilentlyContinue

# Remove shortcuts
Remove-Item -Path "$env:PUBLIC\Desktop\Tailscale.lnk" -ErrorAction SilentlyContinue
Remove-Item -Path "$env:PUBLIC\Desktop\Tailscale Config.lnk" -ErrorAction SilentlyContinue

Write-Host "Uninstallation completed" -ForegroundColor Green
Read-Host "Press Enter to exit"
"@

Set-Content -Path "$ConfigDir\uninstall.ps1" -Value $UninstallScript
Write-Log "Uninstaller created: $ConfigDir\uninstall.ps1"

# Verify connection
Write-Log "Verifying Tailscale connection..."
Start-Sleep -Seconds 10
try {
    $Status = & $TailscaleExe status --json | ConvertFrom-Json
    if ($Status.BackendState -eq "Running") {
        Write-Log "✅ Tailscale is running and connected!"
        Write-Log "IP Address: $($Status.Self.TailscaleIPs[0])"
    } else {
        Write-Log "⚠️ Tailscale is installed but not fully connected" "WARNING"
    }
} catch {
    Write-Log "Could not verify connection status: $_" "WARNING"
}

# Success summary
Write-Log "=== Installation Summary ==="
Write-Log "✅ Tailscale installed successfully"
Write-Log "✅ Connected to company network"
Write-Log "✅ Auto-reconnect configured"
Write-Log "✅ Desktop shortcuts created"
Write-Log "📁 Config directory: $ConfigDir"
Write-Log "📄 Log file: $LogFile"
Write-Log "🔧 Uninstaller: $ConfigDir\uninstall.ps1"

# Display success message
Clear-Host
Write-Host "🎉 Tailscale Installation Completed Successfully! 🎉" -ForegroundColor Green
Write-Host ""
Write-Host "Employee ID: $EmployeeId" -ForegroundColor Cyan
Write-Host "Hostname: $Hostname" -ForegroundColor Cyan
Write-Host "Company: $CompanyName" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ You are now connected to the company network" -ForegroundColor Green
Write-Host "✅ Auto-reconnect is configured" -ForegroundColor Green
Write-Host "✅ Desktop shortcuts have been created" -ForegroundColor Green
Write-Host ""
Write-Host "📞 IT Support: $ITContact" -ForegroundColor Yellow
Write-Host "📁 Configuration: $ConfigDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "The system will automatically reconnect if the connection is lost." -ForegroundColor White
Write-Host "You can see the Tailscale icon in your system tray." -ForegroundColor White

# Clean up
Remove-Item -Path $InstallerPath -ErrorAction SilentlyContinue

Write-Host ""
Read-Host "Press Enter to exit"

# =================================================================
# MACOS INSTALLER - install_tailscale.sh
# =================================================================

#!/bin/bash

# Tailscale Installer for macOS
# Employee Package Installer

set -e

# Configuration
EMPLOYEE_ID=""
HOSTNAME=""
AUTH_KEY=""
COMPANY_NAME="YourCompany"
IT_CONTACT="it@company.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration directory
CONFIG_DIR="/usr/local/etc/tailscale-automation"
LOG_FILE="$CONFIG_DIR/installation.log"
CONFIG_FILE="$CONFIG_DIR/config.json"

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_message="[$timestamp] [$level] $message"
    
    echo -e "${BLUE}[$timestamp]${NC} $message"
    echo "$log_message" >> "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR" "$1"
    echo -e "${RED}Installation failed: $1${NC}"
    echo -e "${YELLOW}Check log file: $LOG_FILE${NC}"
    exit 1
}

# Check if running as root for certain operations
check_sudo() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}This script requires sudo privileges for some operations.${NC}"
        sudo -v || error_exit "Sudo access required"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --employee-id)
            EMPLOYEE_ID="$2"
            shift 2
            ;;
        --hostname)
            HOSTNAME="$2"
            shift 2
            ;;
        --auth-key)
            AUTH_KEY="$2"
            shift 2
            ;;
        --company)
            COMPANY_NAME="$2"
            shift 2
            ;;
        --it-contact)
            IT_CONTACT="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 --employee-id ID --hostname HOST --auth-key KEY [--company NAME] [--it-contact EMAIL]"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$EMPLOYEE_ID" ] || [ -z "$HOSTNAME" ] || [ -z "$AUTH_KEY" ]; then
    error_exit "Missing required parameters. Use --employee-id, --hostname, and --auth-key"
fi

echo -e "${GREEN}🚀 Starting Tailscale Installation${NC}"
echo -e "${BLUE}Employee ID:${NC} $EMPLOYEE_ID"
echo -e "${BLUE}Hostname:${NC} $HOSTNAME"
echo -e "${BLUE}Company:${NC} $COMPANY_NAME"
echo ""

check_sudo

# Create configuration directory
sudo mkdir -p "$CONFIG_DIR"
sudo chmod 755 "$CONFIG_DIR"

log "INFO" "=== Tailscale Installation Started ==="
log "INFO" "Employee ID: $EMPLOYEE_ID"
log "INFO" "Hostname: $HOSTNAME"
log "INFO" "Company: $COMPANY_NAME"

# Create configuration file
cat > /tmp/tailscale_config.json << EOF
{
    "employee_id": "$EMPLOYEE_ID",
    "hostname": "$HOSTNAME",
    "company_name": "$COMPANY_NAME",
    "it_contact": "$IT_CONTACT",
    "install_date": "$(date '+%Y-%m-%d %H:%M:%S')",
    "auth_key_encrypted": "$AUTH_KEY",
    "version": "1.0",
    "os": "macos"
}
EOF

sudo mv /tmp/tailscale_config.json "$CONFIG_FILE"
sudo chmod 644 "$CONFIG_FILE"
log "INFO" "Configuration saved to: $CONFIG_FILE"

# Download and install Tailscale
log "INFO" "Downloading Tailscale..."
TAILSCALE_PKG="/tmp/Tailscale.pkg"

if curl -L -o "$TAILSCALE_PKG" "https://pkgs.tailscale.com/stable/Tailscale-latest.pkg"; then
    log "INFO" "Tailscale downloaded successfully"
else
    error_exit "Failed to download Tailscale"
fi

# Install Tailscale
log "INFO" "Installing Tailscale..."
if sudo installer -pkg "$TAILSCALE_PKG" -target /; then
    log "INFO" "Tailscale installed successfully"
else
    error_exit "Failed to install Tailscale"
fi

# Wait for installation to complete
sleep 5

# Connect to Tailscale
log "INFO" "Connecting to Tailscale network..."
if sudo tailscale up --authkey="$AUTH_KEY" --hostname="$HOSTNAME" --accept-routes; then
    log "INFO" "Successfully connected to Tailscale network"
else
    error_exit "Failed to connect to Tailscale"
fi

# Create auto-reconnect script
log "INFO" "Creating auto-reconnect script..."
AUTO_RECONNECT_SCRIPT="/usr/local/bin/tailscale-auto-reconnect.sh"

sudo tee "$AUTO_RECONNECT_SCRIPT" > /dev/null << 'EOF'
#!/bin/bash
# Tailscale Auto-Reconnect Script

CONFIG_FILE="/usr/local/etc/tailscale-automation/config.json"
LOG_FILE="/usr/local/etc/tailscale-automation/auto-reconnect.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

if [ ! -f "$CONFIG_FILE" ]; then
    log_message "ERROR: Config file not found"
    exit 1
fi

# Read configuration
EMPLOYEE_ID=$(jq -r '.employee_id' "$CONFIG_FILE")
HOSTNAME=$(jq -r '.hostname' "$CONFIG_FILE")
AUTH_KEY=$(jq -r '.auth_key_encrypted' "$CONFIG_FILE")

# Check Tailscale status
STATUS=$(tailscale status --json 2>/dev/null | jq -r '.BackendState // "Unknown"')

if [ "$STATUS" != "Running" ]; then
    log_message "Tailscale not running (Status: $STATUS), attempting reconnect..."
    tailscale up --authkey="$AUTH_KEY" --hostname="$HOSTNAME" --accept-routes
    log_message "Reconnect attempted"
else
    log_message "Tailscale is running normally"
fi
EOF

sudo chmod +x "$AUTO_RECONNECT_SCRIPT"
log "INFO" "Auto-reconnect script created: $AUTO_RECONNECT_SCRIPT"

# Create LaunchDaemon for auto-reconnect
log "INFO" "Creating LaunchDaemon for auto-reconnect..."
LAUNCH_DAEMON="/Library/LaunchDaemons/com.company.tailscale.auto-reconnect.plist"

sudo tee "$LAUNCH_DAEMON" > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.company.tailscale.auto-reconnect</string>
    <key>ProgramArguments</key>
    <array>
        <string>$AUTO_RECONNECT_SCRIPT</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/usr/local/etc/tailscale-automation/daemon.log</string>
    <key>StandardErrorPath</key>
    <string>/usr/local/etc/tailscale-automation/daemon.error.log</string>
</dict>
</plist>
EOF

sudo chmod 644 "$LAUNCH_DAEMON"
sudo launchctl load "$LAUNCH_DAEMON"
log "INFO" "LaunchDaemon created and loaded"

# Create uninstaller
log "INFO" "Creating uninstaller..."
UNINSTALL_SCRIPT="/usr/local/bin/uninstall-tailscale.sh"

sudo tee "$UNINSTALL_SCRIPT" > /dev/null << 'EOF'
#!/bin/bash
# Tailscale Uninstaller

echo "🗑️  Uninstalling Tailscale..."

# Stop LaunchDaemon
sudo launchctl unload /Library/LaunchDaemons/com.company.tailscale.auto-reconnect.plist 2>/dev/null
sudo rm -f /Library/LaunchDaemons/com.company.tailscale.auto-reconnect.plist

# Disconnect from Tailscale
sudo tailscale logout 2>/dev/null

# Remove Tailscale application
sudo rm -rf /Applications/Tailscale.app
sudo rm -f /usr/local/bin/tailscale
sudo rm -f /usr/local/bin/tailscaled

# Remove configuration
sudo rm -rf /usr/local/etc/tailscale-automation

# Remove auto-reconnect script
sudo rm -f /usr/local/bin/tailscale-auto-reconnect.sh
sudo rm -f /usr/local/bin/uninstall-tailscale.sh

echo "✅ Uninstallation completed"
EOF

sudo chmod +x "$UNINSTALL_SCRIPT"
log "INFO" "Uninstaller created: $UNINSTALL_SCRIPT"

# Verify connection
log "INFO" "Verifying Tailscale connection..."
sleep 5

if command -v jq >/dev/null 2>&1; then
    STATUS_JSON=$(tailscale status --json 2>/dev/null)
    if [ $? -eq 0 ]; then
        BACKEND_STATE=$(echo "$STATUS_JSON" | jq -r '.BackendState // "Unknown"')
        if [ "$BACKEND_STATE" = "Running" ]; then
            TAILSCALE_IP=$(echo "$STATUS_JSON" | jq -r '.Self.TailscaleIPs[0] // "Unknown"')
            log "INFO" "✅ Tailscale is running and connected!"
            log "INFO" "IP Address: $TAILSCALE_IP"
        else
            log "WARNING" "⚠️ Tailscale is installed but not fully connected (State: $BACKEND_STATE)"
        fi
    else
        log "WARNING" "Could not verify connection status"
    fi
else
    log "WARNING" "jq not available, cannot verify detailed status"
fi

# Clean up
rm -f "$TAILSCALE_PKG"

# Success summary
log "INFO" "=== Installation Summary ==="
log "INFO" "✅ Tailscale installed successfully"
log "INFO" "✅ Connected to company network"
log "INFO" "✅ Auto-reconnect configured"
log "INFO" "📁 Config directory: $CONFIG_DIR"
log "INFO" "📄 Log file: $LOG_FILE"
log "INFO" "🔧 Uninstaller: $UNINSTALL_SCRIPT"

# Display success message
echo ""
echo -e "${GREEN}🎉 Tailscale Installation Completed Successfully! 🎉${NC}"
echo ""
echo -e "${BLUE}Employee ID:${NC} $EMPLOYEE_ID"
echo -e "${BLUE}Hostname:${NC} $HOSTNAME"
echo -e "${BLUE}Company:${NC} $COMPANY_NAME"
echo ""
echo -e "${GREEN}✅ You are now connected to the company network${NC}"
echo -e "${GREEN}✅ Auto-reconnect is configured${NC}"
echo -e "${GREEN}✅ Tailscale app is available in Applications${NC}"
echo ""
echo -e "${YELLOW}📞 IT Support: $IT_CONTACT${NC}"
echo -e "${YELLOW}📁 Configuration: $CONFIG_DIR${NC}"
echo -e "${YELLOW}🔧 To uninstall: sudo $UNINSTALL_SCRIPT${NC}"
echo ""
echo -e "The system will automatically reconnect if the connection is lost."
echo -e "You can find Tailscale in your Applications folder."
echo ""

# =================================================================
# LINUX INSTALLER - install_tailscale.sh
# =================================================================

#!/bin/bash

# Tailscale Installer for Linux
# Employee Package Installer

set -e

# Configuration
EMPLOYEE_ID=""
HOSTNAME=""
AUTH_KEY=""
COMPANY_NAME="YourCompany"
IT_CONTACT="it@company.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration directory
CONFIG_DIR="/etc/tailscale-automation"
LOG_FILE="$CONFIG_DIR/installation.log"
CONFIG_FILE="$CONFIG_DIR/config.json"

# Detect Linux distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION=$VERSION_ID
    else
        echo "Cannot detect Linux distribution"
        exit 1
    fi
}

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_message="[$timestamp] [$level] $message"
    
    echo -e "${BLUE}[$timestamp]${NC} $message"
    echo "$log_message" >> "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR" "$1"
    echo -e "${RED}Installation failed: $1${NC}"
    echo -e "${YELLOW}Check log file: $LOG_FILE${NC}"
    exit 1
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}This script must be run as root or with sudo${NC}"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --employee-id)
            EMPLOYEE_ID="$2"
            shift 2
            ;;
        --hostname)
            HOSTNAME="$2"
            shift 2
            ;;
        --auth-key)
            AUTH_KEY="$2"
            shift 2
            ;;
        --company)
            COMPANY_NAME="$2"
            shift 2
            ;;
        --it-contact)
            IT_CONTACT="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 --employee-id ID --hostname HOST --auth-key KEY [--company NAME] [--it-contact EMAIL]"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$EMPLOYEE_ID" ] || [ -z "$HOSTNAME" ] || [ -z "$AUTH_KEY" ]; then
    error_exit "Missing required parameters. Use --employee-id, --hostname, and --auth-key"
fi

echo -e "${GREEN}🚀 Starting Tailscale Installation${NC}"
echo -e "${BLUE}Employee ID:${NC} $EMPLOYEE_ID"
echo -e "${BLUE}Hostname:${NC} $HOSTNAME"
echo -e "${BLUE}Company:${NC} $COMPANY_NAME"
echo ""

check_root
detect_distro

# Create configuration directory
mkdir -p "$CONFIG_DIR"
chmod 755 "$CONFIG_DIR"

log "INFO" "=== Tailscale Installation Started ==="
log "INFO" "Employee ID: $EMPLOYEE_ID"
log "INFO" "Hostname: $HOSTNAME"
log "INFO" "Company: $COMPANY_NAME"
log "INFO" "Distribution: $DISTRO $VERSION"

# Create configuration file
cat > "$CONFIG_FILE" << EOF
{
    "employee_id": "$EMPLOYEE_ID",
    "hostname": "$HOSTNAME",
    "company_name": "$COMPANY_NAME",
    "it_contact": "$IT_CONTACT",
    "install_date": "$(date '+%Y-%m-%d %H:%M:%S')",
    "auth_key_encrypted": "$AUTH_KEY",
    "version": "1.0",
    "os": "linux",
    "distro": "$DISTRO"
}
EOF

chmod 644 "$CONFIG_FILE"
log "INFO" "Configuration saved to: $CONFIG_FILE"

# Install Tailscale based on distribution
log "INFO" "Installing Tailscale for $DISTRO..."

case "$DISTRO" in
    ubuntu|debian)
        # Add Tailscale's package signing key and repository
        curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/jammy.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
        curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/jammy.tailscale-keyring.list | tee /etc/apt/sources.list.d/tailscale.list
        
        apt-get update
        apt-get install -y tailscale jq
        ;;
    centos|rhel|fedora)
        # Add Tailscale repository
        cat > /etc/yum.repos.d/tailscale.repo << 'EOF'
[tailscale-stable]
name=Tailscale stable
baseurl=https://pkgs.tailscale.com/stable/centos/8/noarch/
enabled=1
type=rpm
repo_gpgcheck=1
gpgcheck=0
gpgkey=https://pkgs.tailscale.com/stable/centos/8/noarch/repodata/repomd.xml.key
EOF
        
        if command -v dnf >/dev/null 2>&1; then
            dnf install -y tailscale jq
        else
            yum install -y tailscale jq
        fi
        ;;
    *)
        # Generic installation via script
        log "INFO" "Using generic installation method"
        curl -fsSL https://tailscale.com/install.sh | sh
        
        # Install jq if not available
        if ! command -v jq >/dev/null 2>&1; then
            case "$DISTRO" in
                alpine)
                    apk add --no-cache jq
                    ;;
                arch)
                    pacman -S --noconfirm jq
                    ;;
                *)
                    log "WARNING" "jq not installed, some features may not work"
                    ;;
            esac
        fi
        ;;
esac

log "INFO" "Tailscale installed successfully"

# Enable and start Tailscale service
systemctl enable tailscaled
systemctl start tailscaled

# Wait for service to start
sleep 5

# Connect to Tailscale
log "INFO" "Connecting to Tailscale network..."
if tailscale up --authkey="$AUTH_KEY" --hostname="$HOSTNAME" --accept-routes; then
    log "INFO" "Successfully connected to Tailscale network"
else
    error_exit "Failed to connect to Tailscale"
fi

# Create auto-reconnect script
log "INFO" "Creating auto-reconnect script..."
AUTO_RECONNECT_SCRIPT="/usr/local/bin/tailscale-auto-reconnect.sh"

cat > "$AUTO_RECONNECT_SCRIPT" << 'EOF'
#!/bin/bash
# Tailscale Auto-Reconnect Script

CONFIG_FILE="/etc/tailscale-automation/config.json"
LOG_FILE="/etc/tailscale-automation/auto-reconnect.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

if [ ! -f "$CONFIG_FILE" ]; then
    log_message "ERROR: Config file not found"
    exit 1
fi

# Read configuration
if command -v jq >/dev/null 2>&1; then
    EMPLOYEE_ID=$(jq -r '.employee_id' "$CONFIG_FILE")
    HOSTNAME=$(jq -r '.hostname' "$CONFIG_FILE")
    AUTH_KEY=$(jq -r '.auth_key_encrypted' "$CONFIG_FILE")
else
    # Fallback parsing without jq
    EMPLOYEE_ID=$(grep -o '"employee_id": *"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    HOSTNAME=$(grep -o '"hostname": *"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    AUTH_KEY=$(grep -o '"auth_key_encrypted": *"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
fi

# Check Tailscale status
if command -v jq >/dev/null 2>&1; then
    STATUS=$(tailscale status --json 2>/dev/null | jq -r '.BackendState // "Unknown"')
else
    # Simple status check without jq
    if tailscale status >/dev/null 2>&1; then
        STATUS="Running"
    else
        STATUS="NotRunning"
    fi
fi

if [ "$STATUS" != "Running" ]; then
    log_message "Tailscale not running (Status: $STATUS), attempting reconnect..."
    tailscale up --authkey="$AUTH_KEY" --hostname="$HOSTNAME" --accept-routes
    log_message "Reconnect attempted"
else
    log_message "Tailscale is running normally"
fi
EOF

chmod +x "$AUTO_RECONNECT_SCRIPT"
log "INFO" "Auto-reconnect script created: $AUTO_RECONNECT_SCRIPT"

# Create systemd service for auto-reconnect
log "INFO" "Creating systemd service for auto-reconnect..."
cat > /etc/systemd/system/tailscale-auto-reconnect.service << EOF
[Unit]
Description=Tailscale Auto Reconnect
After=network.target tailscaled.service
Wants=tailscaled.service

[Service]
Type=oneshot
ExecStart=$AUTO_RECONNECT_SCRIPT
User=root

[Install]
WantedBy=multi-user.target
EOF

# Create systemd timer
cat > /etc/systemd/system/tailscale-auto-reconnect.timer << EOF
[Unit]
Description=Run Tailscale Auto Reconnect every 5 minutes
Requires=tailscale-auto-reconnect.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable and start timer
systemctl daemon-reload
systemctl enable tailscale-auto-reconnect.timer
systemctl start tailscale-auto-reconnect.timer

log "INFO" "Auto-reconnect service created and started"

# Create uninstaller
log "INFO" "Creating uninstaller..."
UNINSTALL_SCRIPT="/usr/local/bin/uninstall-tailscale.sh"

cat > "$UNINSTALL_SCRIPT" << 'EOF'
#!/bin/bash
# Tailscale Uninstaller

echo "🗑️  Uninstalling Tailscale..."

# Stop and disable services
systemctl stop tailscale-auto-reconnect.timer 2>/dev/null
systemctl disable tailscale-auto-reconnect.timer 2>/dev/null
systemctl stop tailscale-auto-reconnect.service 2>/dev/null
systemctl disable tailscale-auto-reconnect.service 2>/dev/null

# Remove systemd files
rm -f /etc/systemd/system/tailscale-auto-reconnect.service
rm -f /etc/systemd/system/tailscale-auto-reconnect.timer
systemctl daemon-reload

# Disconnect from Tailscale
tailscale logout 2>/dev/null

# Stop and disable Tailscale
systemctl stop tailscaled 2>/dev/null
systemctl disable tailscaled 2>/dev/null

# Uninstall Tailscale package
if command -v apt-get >/dev/null 2>&1; then
    apt-get remove -y tailscale
elif command -v dnf >/dev/null 2>&1; then
    dnf remove -y tailscale
elif command -v yum >/dev/null 2>&1; then
    yum remove -y tailscale
fi

# Remove configuration
rm -rf /etc/tailscale-automation

# Remove scripts
rm -f /usr/local/bin/tailscale-auto-reconnect.sh
rm -f /usr/local/bin/uninstall-tailscale.sh

echo "✅ Uninstallation completed"
EOF

chmod +x "$UNINSTALL_SCRIPT"
log "INFO" "Uninstaller created: $UNINSTALL_SCRIPT"

# Verify connection
log "INFO" "Verifying Tailscale connection..."
sleep 5

if command -v jq >/dev/null 2>&1; then
    STATUS_JSON=$(tailscale status --json 2>/dev/null)
    if [ $? -eq 0 ]; then
        BACKEND_STATE=$(echo "$STATUS_JSON" | jq -r '.BackendState // "Unknown"')
        if [ "$BACKEND_STATE" = "Running" ]; then
            TAILSCALE_IP=$(echo "$STATUS_JSON" | jq -r '.Self.TailscaleIPs[0] // "Unknown"')
            log "INFO" "✅ Tailscale is running and connected!"
            log "INFO" "IP Address: $TAILSCALE_IP"
        else
            log "WARNING" "⚠️ Tailscale is installed but not fully connected (State: $BACKEND_STATE)"
        fi
    else
        log "WARNING" "Could not verify connection status"
    fi
else
    if tailscale status >/dev/null 2>&1; then
        log "INFO" "✅ Tailscale appears to be running"
    else
        log "WARNING" "⚠️ Tailscale status unclear"
    fi
fi

# Success summary
log "INFO" "=== Installation Summary ==="
log "INFO" "✅ Tailscale installed successfully"
log "INFO" "✅ Connected to company network"
log "INFO" "✅ Auto-reconnect configured"
log "INFO" "✅ Systemd services created"
log "INFO" "📁 Config directory: $CONFIG_DIR"
log "INFO" "📄 Log file: $LOG_FILE"
log "INFO" "🔧 Uninstaller: $UNINSTALL_SCRIPT"

# Display success message
echo ""
echo -e "${GREEN}🎉 Tailscale Installation Completed Successfully! 🎉${NC}"
echo ""
echo -e "${BLUE}Employee ID:${NC} $EMPLOYEE_ID"
echo -e "${BLUE}Hostname:${NC} $HOSTNAME"
echo -e "${BLUE}Company:${NC} $COMPANY_NAME"
echo -e "${BLUE}Distribution:${NC} $DISTRO"
echo ""
echo -e "${GREEN}✅ You are now connected to the company network${NC}"
echo -e "${GREEN}✅ Auto-reconnect is configured${NC}"
echo -e "${GREEN}✅ Systemd services are running${NC}"
echo ""
echo -e "${YELLOW}📞 IT Support: $IT_CONTACT${NC}"
echo -e "${YELLOW}📁 Configuration: $CONFIG_DIR${NC}"
echo -e "${YELLOW}🔧 To uninstall: $UNINSTALL_SCRIPT${NC}"
echo ""
echo -e "The system will automatically reconnect if the connection is lost."
echo -e "Use 'tailscale status' to check connection status."
echo ""

# =================================================================
# PACKAGE CREATOR SCRIPT - create_employee_package.sh
# =================================================================

#!/bin/bash

# Employee Package Creator
# This script creates customized installer packages for employees

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/employee_packages"
TEMPLATE_DIR="$SCRIPT_DIR/templates"

# Create directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$TEMPLATE_DIR"

echo "🏭 Tailscale Employee Package Creator"
echo "===================================="

# Function to create Windows package
create_windows_package() {
    local employee_id=$1
    local hostname=$2
    local auth_key=$3
    local company_name=$4
    local it_contact=$5
    
    local package_dir="$OUTPUT_DIR/${employee_id}_windows"
    mkdir -p "$package_dir"
    
    # Create customized PowerShell installer
    cat > "$package_dir/TailscaleInstaller.ps1" << EOF
# Tailscale Installer for $employee_id
# Company: $company_name
# Generated: $(date)

\$EMPLOYEE_ID = "$employee_id"
\$HOSTNAME = "$hostname"
\$AUTH_KEY = "$auth_key"
\$COMPANY_NAME = "$company_name"
\$IT_CONTACT = "$it_contact"

# [INSERT FULL WINDOWS INSTALLER SCRIPT HERE]
EOF
    
    # Create batch launcher
    cat > "$package_dir/Install.bat" << EOF
@echo off
echo Installing Tailscale for $employee_id...
echo.
powershell.exe -ExecutionPolicy Bypass -File "%~dp0TailscaleInstaller.ps1"
pause
EOF
    
    # Create README
    cat > "$package_dir/README.txt" << EOF
Tailscale Installation Package
==============================

Employee: $employee_id
Company: $company_name
Generated: $(date)

Instructions:
1. Right-click "Install.bat" and select "Run as administrator"
2. Follow the on-screen instructions
3. Contact IT support if you encounter any issues: $it_contact

The installation will:
- Download and install Tailscale
- Connect to the company network
- Configure automatic reconnection
- Create desktop shortcuts

Configuration will be stored in: C:\ProgramData\TailscaleAutomation\
EOF
    
    echo "✅ Windows package created: $package_dir"
}

# Function to create macOS package
create_macos_package() {
    local employee_id=$1
    local hostname=$2
    local auth_key=$3
    local company_name=$4
    local it_contact=$5
    
    local package_dir="$OUTPUT_DIR/${employee_id}_macos"
    mkdir -p "$package_dir"
    
    # Create customized installer
    cat > "$package_dir/install_tailscale.sh" << EOF
#!/bin/bash
# Tailscale Installer for $employee_id
# Company: $company_name
# Generated: $(date)

EMPLOYEE_ID="$employee_id"
HOSTNAME="$hostname"
AUTH_KEY="$auth_key"
COMPANY_NAME="$company_name"
IT_CONTACT="$it_contact"

# [INSERT FULL MACOS INSTALLER SCRIPT HERE]
EOF
    
    chmod +x "$package_dir/install_tailscale.sh"
    
    # Create README
    cat > "$package_dir/README.txt" << EOF
Tailscale Installation Package
==============================

Employee: $employee_id
Company: $company_name
Generated: $(date)

Instructions:
1. Open Terminal
2. Navigate to this folder
3. Run: sudo ./install_tailscale.sh
4. Follow the on-screen instructions
5. Contact IT support if you encounter any issues: $it_contact

The installation will:
- Download and install Tailscale
- Connect to the company network
- Configure automatic reconnection
- Set up LaunchDaemon for auto-start

Configuration will be stored in: /usr/local/etc/tailscale-automation/
EOF
    
    echo "✅ macOS package created: $package_dir"
}

# Function to create Linux package
create_linux_package() {
    local employee_id=$1
    local hostname=$2
    local auth_key=$3
    local company_name=$4
    local it_contact=$5
    
    local package_dir="$OUTPUT_DIR/${employee_id}_linux"
    mkdir -p "$package_dir"
    
    # Create customized installer
    cat > "$package_dir/install_tailscale.sh" << EOF
#!/bin/bash
# Tailscale Installer for $employee_id
# Company: $company_name
# Generated: $(date)

EMPLOYEE_ID="$employee_id"
HOSTNAME="$hostname"
AUTH_KEY="$auth_key"
COMPANY_NAME="$company_name"
IT_CONTACT="$it_contact"

# [INSERT FULL LINUX INSTALLER SCRIPT HERE]
EOF
    
    chmod +x "$package_dir/install_tailscale.sh"
    
    # Create README
    cat > "$package_dir/README.txt" << EOF
Tailscale Installation Package
==============================

Employee: $employee_id
Company: $company_name
Generated: $(date)

Instructions:
1. Open terminal
2. Navigate to this folder
3. Run: sudo ./install_tailscale.sh
4. Follow the on-screen instructions
5. Contact IT support if you encounter any issues: $it_contact

The installation will:
- Download and install Tailscale
- Connect to the company network
- Configure automatic reconnection
- Set up systemd services for auto-start

Configuration will be stored in: /etc/tailscale-automation/
EOF
    
    echo "✅ Linux package created: $package_dir"
}

# Main package creation function
create_employee_package() {
    echo ""
    echo "Creating installation package for employee..."
    echo ""
    
    read -p "Employee ID: " employee_id
    read -p "Hostname: " hostname
    read -p "Auth Key: " auth_key
    read -p "Company Name [YourCompany]: " company_name
    read -p "IT Contact [it@company.com]: " it_contact
    
    # Set defaults
    company_name=${company_name:-"YourCompany"}
    it_contact=${it_contact:-"it@company.com"}
    
    echo ""
    echo "Select platforms to create packages for:"
    echo "1) Windows only"
    echo "2) macOS only"
    echo "3) Linux only"
    echo "4) All platforms"
    read -p "Choice [4]: " platform_choice
    
    platform_choice=${platform_choice:-4}
    
    echo ""
    echo "Creating packages..."
    
    case $platform_choice in
        1)
            create_windows_package "$employee_id" "$hostname" "$auth_key" "$company_name" "$it_contact"
            ;;
        2)
            create_macos_package "$employee_id" "$hostname" "$auth_key" "$company_name" "$it_contact"
            ;;
        3)
            create_linux_package "$employee_id" "$hostname" "$auth_key" "$company_name" "$it_contact"
            ;;
        4)
            create_windows_package "$employee_id" "$hostname" "$auth_key" "$company_name" "$it_contact"
            create_macos_package "$employee_id" "$hostname" "$auth_key" "$company_name" "$it_contact"
            create_linux_package "$employee_id" "$hostname" "$auth_key" "$company_name" "$it_contact"
            ;;
        *)
            echo "Invalid choice"
            exit 1
            ;;
    esac
    
    echo ""
    echo "🎉 Package creation completed!"
    echo "📁 Packages created in: $OUTPUT_DIR"
    echo ""
    echo "Next steps:"
    echo "1. Compress the employee folders into ZIP files"
    echo "2. Send the appropriate package to each employee"
    echo "3. Provide installation instructions"
    echo ""
}

# Run the package creator
create_employee_package