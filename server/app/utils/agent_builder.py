import os
import tempfile
import subprocess
from typing import Dict
import base64

AGENT_TEMPLATE = '''
import os
import sys
import time
import requests
import subprocess
import winreg
import logging
from pathlib import Path

# Configuration
CONFIG = {config_placeholder}

class TailscaleAgent:
    def __init__(self):
        self.log_path = Path(CONFIG["log_path"])
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        
        logging.basicConfig(
            filename=self.log_path,
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def log(self, message, level="info"):
        print(f"[{level.upper()}] {message}")
        getattr(self.logger, level)(message)

    def is_admin(self):
        try:
            return os.getuid() == 0
        except AttributeError:
            import ctypes
            return ctypes.windll.shell32.IsUserAnAdmin() != 0

    def get_auth_key(self):
        """Get auth key from primary or fallback URL"""
        urls = [CONFIG["auth_key_url"], CONFIG["fallback_url"]]
        token = CONFIG.get("security_token", "")
        
        for url in urls:
            try:
                params = {"token": token} if token else {}
                response = requests.get(url, params=params, timeout=10)
                if response.status_code == 200:
                    auth_key = response.text.strip()
                    if auth_key.startswith("tskey-"):
                        self.log(f"Got auth key from {url}")
                        return auth_key
            except Exception as e:
                self.log(f"Failed to get key from {url}: {e}", "warning")
        
        raise Exception("Failed to get auth key from all URLs")

    def is_tailscale_installed(self):
        try:
            result = subprocess.run(["tailscale", "version"], 
                                  capture_output=True, text=True)
            return result.returncode == 0
        except:
            return False

    def install_tailscale(self):
        """Install Tailscale if not present"""
        if self.is_tailscale_installed():
            self.log("Tailscale already installed")
            return True

        self.log("Installing Tailscale...")
        try:
            # Download and install Tailscale
            download_url = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
            installer_path = os.path.join(tempfile.gettempdir(), "tailscale-setup.exe")
            
            response = requests.get(download_url, stream=True)
            with open(installer_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            # Install silently
            result = subprocess.run([installer_path, "/S"], check=True)
            self.log("Tailscale installed successfully")
            return True
            
        except Exception as e:
            self.log(f"Failed to install Tailscale: {e}", "error")
            return False

    def connect_tailscale(self):
        """Connect to Tailscale network"""
        try:
            auth_key = self.get_auth_key()
            
            # Try to connect
            cmd = ["tailscale", "up", "--authkey", auth_key, "--unattended"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                self.log("Successfully connected to Tailscale")
                return True
            else:
                self.log(f"Failed to connect: {result.stderr}", "error")
                return False
                
        except Exception as e:
            self.log(f"Connection failed: {e}", "error")
            return False

    def setup_auto_start(self):
        """Setup Windows auto-start"""
        if not CONFIG.get("auto_start", True):
            return True
            
        try:
            key_path = r"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run"
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
                winreg.SetValueEx(key, "ATT_Tailscale_Agent", 0, winreg.REG_SZ, sys.executable)
            
            self.log("Auto-start configured")
            return True
        except Exception as e:
            self.log(f"Failed to setup auto-start: {e}", "error")
            return False

    def monitor_connection(self):
        """Monitor and repair connection"""
        while CONFIG.get("auto_repair", True):
            try:
                result = subprocess.run(["tailscale", "status"], 
                                      capture_output=True, text=True)
                if result.returncode != 0:
                    self.log("Connection lost, attempting repair...", "warning")
                    self.connect_tailscale()
                
                time.sleep(60)  # Check every minute
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                self.log(f"Monitor error: {e}", "error")
                time.sleep(60)

    def run(self):
        """Main execution flow"""
        self.log("ATT Tailscale Agent starting...")
        
        if not self.is_admin():
            self.log("Please run as Administrator", "error")
            return False
        
        # Install Tailscale if needed
        if not self.install_tailscale():
            return False
        
        # Connect to network
        if not self.connect_tailscale():
            return False
        
        # Setup auto-start
        self.setup_auto_start()
        
        # Start monitoring
        self.log("Starting connection monitor...")
        self.monitor_connection()
        
        return True

if __name__ == "__main__":
    agent = TailscaleAgent()
    try:
        agent.run()
    except Exception as e:
        agent.log(f"Agent failed: {e}", "error")
        input("Press Enter to exit...")
'''

async def build_windows_agent(config: Dict) -> str:
    """Build Windows agent executable with configuration"""
    
    # Replace config in template
    agent_code = AGENT_TEMPLATE.replace(
        "{config_placeholder}", 
        str(config).replace("'", '"')
    )
    
    # Create temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        agent_py = os.path.join(temp_dir, "agent.py")
        
        # Write agent code
        with open(agent_py, "w") as f:
            f.write(agent_code)
        
        # Create PyInstaller spec
        spec_content = f'''
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['{agent_py}'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['requests', 'winreg'],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='tailscale-agent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    uac_admin=True,
)
'''
        
        spec_file = os.path.join(temp_dir, "agent.spec")
        with open(spec_file, "w") as f:
            f.write(spec_content)
        
        # Build with PyInstaller
        result = subprocess.run([
            "pyinstaller", "--clean", spec_file
        ], cwd=temp_dir, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"PyInstaller failed: {result.stderr}")
        
        # Move built executable
        built_exe = os.path.join(temp_dir, "dist", "tailscale-agent.exe")
        output_path = "/tmp/tailscale-agent.exe"
        
        if os.path.exists(built_exe):
            os.rename(built_exe, output_path)
            return output_path
        else:
            raise Exception("Built executable not found")