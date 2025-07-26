#!/bin/bash

# ===================================================================
# TAILSCALE AUTOMATION MANAGEMENT SYSTEM
# ===================================================================

# Configuration
TAILSCALE_API_KEY="tskey-api-kJnyX1RwT511CNTRL-R6Bt27X9oZBE6NsWn2tSZBQojCLg4s9g"
TAILNET="tail4bf581.ts.net"
CONFIG_DIR="/opt/tailscale-automation"
LOG_FILE="/var/log/tailscale-automation.log"
EMPLOYEES_CONFIG="$CONFIG_DIR/employees.json"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ===================================================================
# 1. EMPLOYEE CONFIGURATION SETUP
# ===================================================================

setup_employee_config() {
    mkdir -p "$CONFIG_DIR"
    
    # Create config file for employee list
    cat > "$EMPLOYEES_CONFIG" << 'EOF'
{
  "employees": [
    {
      "id": "emp001",
      "name": "Nguyen Van A",
      "email": "a@company.com",
      "department": "IT",
      "location": "Hanoi",
      "hostname": "laptop-a",
      "os": "windows"
    },
    {
      "id": "emp002", 
      "name": "Tran Thi B",
      "email": "b@company.com",
      "department": "Marketing",
      "location": "HCMC",
      "hostname": "laptop-b",
      "os": "macos"
    }
  ]
}
EOF

    log "Employee configuration created at $EMPLOYEES_CONFIG"
}

# ===================================================================
# 2. AUTH KEY MANAGEMENT
# ===================================================================

create_auth_key() {
    local employee_id=$1
    local employee_name=$2
    
    # Create new auth key via Tailscale API
    local response=$(curl -s -X POST \
        -H "Authorization: Bearer $TAILSCALE_API_KEY" \
        -H "Content-Type: application/json" \
        "https://api.tailscale.com/api/v2/tailnet/$TAILNET/keys" \
        -d '{
            "capabilities": {
                "devices": {
                    "create": {
                        "reusable": false,
                        "ephemeral": false,
                        "preauthorized": true,
                        "tags": ["tag:employee"]
                    }
                }
            },
            "expirySeconds": 2592000,
            "description": "Auto-generated for '"$employee_name"' ('"$employee_id"')"
        }')
    
    local auth_key=$(echo "$response" | jq -r '.key')
    
    if [[ "$auth_key" != "null" && "$auth_key" != "" ]]; then
        # Save auth key to encrypted file
        echo "$auth_key" | gpg --cipher-algo AES256 --compress-algo 1 --symmetric --output "$CONFIG_DIR/${employee_id}_authkey.gpg"
        log "Created new auth key for $employee_name ($employee_id)"
        echo "$auth_key"
    else
        log "ERROR: Failed to create auth key for $employee_id"
        return 1
    fi
}

get_auth_key() {
    local employee_id=$1
    
    if [[ -f "$CONFIG_DIR/${employee_id}_authkey.gpg" ]]; then
        gpg --quiet --batch --decrypt "$CONFIG_DIR/${employee_id}_authkey.gpg" 2>/dev/null
    else
        log "No auth key found for $employee_id, creating new one..."
        local employee_name=$(jq -r ".employees[] | select(.id==\"$employee_id\") | .name" "$EMPLOYEES_CONFIG")
        create_auth_key "$employee_id" "$employee_name"
    fi
}

# ===================================================================
# 3. DEPLOYMENT SCRIPTS GENERATION
# ===================================================================

generate_windows_script() {
    local employee_id=$1
    local auth_key=$2
    local hostname=$3
    
    cat > "$CONFIG_DIR/deploy_${employee_id}_windows.ps1" << EOF
# Tailscale Auto-Deploy Script for Windows
# Employee: $employee_id

Write-Host "Installing Tailscale for $employee_id..."

# Download and install Tailscale
$url = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
$output = "$env:TEMP\tailscale-setup.exe"
Invoke-WebRequest -Uri $url -OutFile $output

Start-Process -FilePath $output -ArgumentList "/quiet" -Wait

# Wait for service to start
Start-Sleep -Seconds 10

# Connect with auth key
& "C:\Program Files\Tailscale\tailscale.exe" up --authkey="$auth_key" --hostname="$hostname" --accept-routes

# Create scheduled task to auto-reconnect
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\ProgramData\Tailscale\auto-reconnect.ps1"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "TailscaleAutoReconnect" -Action $action -Trigger $trigger -Settings $settings -Principal $principal

Write-Host "Tailscale installed and configured successfully!"
EOF

    # Create auto-reconnect script
    cat > "$CONFIG_DIR/auto-reconnect-${employee_id}.ps1" << EOF
# Auto-reconnect script
$tailscaleStatus = & "C:\Program Files\Tailscale\tailscale.exe" status --json | ConvertFrom-Json

if ($tailscaleStatus.BackendState -ne "Running") {
    Write-Host "Tailscale not running, attempting to reconnect..."
    & "C:\Program Files\Tailscale\tailscale.exe" up --authkey="$auth_key" --hostname="$hostname"
}
EOF

    log "Generated Windows deployment script for $employee_id"
}

generate_macos_script() {
    local employee_id=$1
    local auth_key=$2
    local hostname=$3
    
    cat > "$CONFIG_DIR/deploy_${employee_id}_macos.sh" << EOF
#!/bin/bash
# Tailscale Auto-Deploy Script for macOS
# Employee: $employee_id

echo "Installing Tailscale for $employee_id..."

# Download and install Tailscale
curl -o /tmp/Tailscale.pkg https://pkgs.tailscale.com/stable/Tailscale-latest.pkg
sudo installer -pkg /tmp/Tailscale.pkg -target /

# Connect with auth key
sudo tailscale up --authkey="$auth_key" --hostname="$hostname" --accept-routes

# Create LaunchDaemon to auto-reconnect
sudo tee /Library/LaunchDaemons/com.tailscale.auto-reconnect.plist << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.tailscale.auto-reconnect</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/tailscale-auto-reconnect.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
PLIST

# Create auto-reconnect script
sudo tee /usr/local/bin/tailscale-auto-reconnect.sh << 'RECONNECT'
#!/bin/bash
STATUS=$(tailscale status --json | jq -r '.BackendState')
if [[ "$STATUS" != "Running" ]]; then
    echo "Tailscale not running, attempting to reconnect..."
    tailscale up --authkey="$auth_key" --hostname="$hostname"
fi
RECONNECT

sudo chmod +x /usr/local/bin/tailscale-auto-reconnect.sh
sudo launchctl load /Library/LaunchDaemons/com.tailscale.auto-reconnect.plist

echo "Tailscale installed and configured successfully!"
EOF

    chmod +x "$CONFIG_DIR/deploy_${employee_id}_macos.sh"
    log "Generated macOS deployment script for $employee_id"
}

generate_linux_script() {
    local employee_id=$1
    local auth_key=$2
    local hostname=$3
    
    cat > "$CONFIG_DIR/deploy_${employee_id}_linux.sh" << EOF
#!/bin/bash
# Tailscale Auto-Deploy Script for Linux
# Employee: $employee_id

echo "Installing Tailscale for $employee_id..."

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Connect with auth key
sudo tailscale up --authkey="$auth_key" --hostname="$hostname" --accept-routes

# Create systemd service to auto-reconnect
sudo tee /etc/systemd/system/tailscale-auto-reconnect.service << SERVICE
[Unit]
Description=Tailscale Auto Reconnect
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/tailscale-auto-reconnect.sh
User=root

[Install]
WantedBy=multi-user.target
SERVICE

# Create timer for the service
sudo tee /etc/systemd/system/tailscale-auto-reconnect.timer << TIMER
[Unit]
Description=Run Tailscale Auto Reconnect every 5 minutes
Requires=tailscale-auto-reconnect.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
TIMER

# Create auto-reconnect script
sudo tee /usr/local/bin/tailscale-auto-reconnect.sh << 'RECONNECT'
#!/bin/bash
STATUS=$(tailscale status --json | jq -r '.BackendState')
if [[ "$STATUS" != "Running" ]]; then
    echo "Tailscale not running, attempting to reconnect..."
    tailscale up --authkey="$auth_key" --hostname="$hostname"
fi
RECONNECT

sudo chmod +x /usr/local/bin/tailscale-auto-reconnect.sh

# Enable and start services
sudo systemctl enable tailscale-auto-reconnect.timer
sudo systemctl start tailscale-auto-reconnect.timer

echo "Tailscale installed and configured successfully!"
EOF

    chmod +x "$CONFIG_DIR/deploy_${employee_id}_linux.sh"
    log "Generated Linux deployment script for $employee_id"
}

# ===================================================================
# 4. MAIN DEPLOYMENT FUNCTION
# ===================================================================

deploy_for_employee() {
    local employee_id=$1
    
    # Get employee information
    local employee_data=$(jq ".employees[] | select(.id==\"$employee_id\")" "$EMPLOYEES_CONFIG")
    
    if [[ -z "$employee_data" ]]; then
        log "ERROR: Employee $employee_id not found in configuration"
        return 1
    fi
    
    local name=$(echo "$employee_data" | jq -r '.name')
    local hostname=$(echo "$employee_data" | jq -r '.hostname')
    local os=$(echo "$employee_data" | jq -r '.os')
    
    log "Deploying Tailscale for $name ($employee_id) - OS: $os"
    
    # Get or create new auth key
    local auth_key=$(get_auth_key "$employee_id")
    
    if [[ -z "$auth_key" ]]; then
        log "ERROR: Could not obtain auth key for $employee_id"
        return 1
    fi
    
    # Generate deployment script based on OS
    case "$os" in
        "windows")
            generate_windows_script "$employee_id" "$auth_key" "$hostname"
            ;;
        "macos")
            generate_macos_script "$employee_id" "$auth_key" "$hostname"
            ;;
        "linux")
            generate_linux_script "$employee_id" "$auth_key" "$hostname"
            ;;
        *)
            log "ERROR: Unsupported OS: $os for employee $employee_id"
            return 1
            ;;
    esac
    
    log "Deployment script generated for $employee_id"
}

# ===================================================================
# 5. AUTH KEY RENEWAL SYSTEM
# ===================================================================

check_and_renew_auth_keys() {
    log "Checking auth key expiration for all employees..."
    
    # List all devices in tailnet
    local devices=$(curl -s -H "Authorization: Bearer $TAILSCALE_API_KEY" \
        "https://api.tailscale.com/api/v2/tailnet/$TAILNET/devices")
    
    # Check each employee
    jq -r '.employees[].id' "$EMPLOYEES_CONFIG" | while read employee_id; do
        local employee_name=$(jq -r ".employees[] | select(.id==\"$employee_id\") | .name" "$EMPLOYEES_CONFIG")
        
        # Check if device is still active
        local device_active=$(echo "$devices" | jq --arg hostname "$(jq -r ".employees[] | select(.id==\"$employee_id\") | .hostname" "$EMPLOYEES_CONFIG")" \
            '.devices[] | select(.hostname==$hostname) | .online')
        
        if [[ "$device_active" != "true" ]]; then
            log "Device for $employee_id appears offline, regenerating auth key..."
            create_auth_key "$employee_id" "$employee_name"
            deploy_for_employee "$employee_id"
        fi
    done
}

# ===================================================================
# 6. MONITORING AND MANAGEMENT
# ===================================================================

monitor_tailscale_status() {
    log "=== Tailscale Status Report ==="
    
    local devices=$(curl -s -H "Authorization: Bearer $TAILSCALE_API_KEY" \
        "https://api.tailscale.com/api/v2/tailnet/$TAILNET/devices")
    
    echo "$devices" | jq -r '.devices[] | "\(.hostname): \(.online) (Last seen: \(.lastSeen))"' | while read line; do
        log "$line"
    done
}

create_management_cron() {
    # Create cron job to check auth key every day
    (crontab -l 2>/dev/null; echo "0 2 * * * $0 check_keys") | crontab -
    
    # Create cron job to monitor status every hour
    (crontab -l 2>/dev/null; echo "0 * * * * $0 monitor") | crontab -
    
    log "Management cron jobs created"
}

# ===================================================================
# 7. BULK OPERATIONS
# ===================================================================

deploy_all() {
    log "Starting bulk deployment for all employees..."
    
    jq -r '.employees[].id' "$EMPLOYEES_CONFIG" | while read employee_id; do
        deploy_for_employee "$employee_id"
        sleep 2  # Avoid API rate limiting
    done
    
    log "Bulk deployment completed"
}

# ===================================================================
# 8. MAIN SCRIPT LOGIC
# ===================================================================

case "${1:-}" in
    "setup")
        setup_employee_config
        create_management_cron
        ;;
    "deploy")
        if [[ -n "${2:-}" ]]; then
            deploy_for_employee "$2"
        else
            deploy_all
        fi
        ;;
    "check_keys")
        check_and_renew_auth_keys
        ;;
    "monitor")
        monitor_tailscale_status
        ;;
    "status")
        monitor_tailscale_status
        ;;
    *)
        echo "Usage: $0 {setup|deploy [employee_id]|check_keys|monitor|status}"
        echo ""
        echo "Commands:"
        echo "  setup           - Initialize configuration and cron jobs"
        echo "  deploy          - Deploy to all employees"
        echo "  deploy emp001   - Deploy to specific employee"
        echo "  check_keys      - Check and renew expiring auth keys"
        echo "  monitor         - Show current status of all devices"
        echo "  status          - Show current status of all devices"
        exit 1
        ;;
esac