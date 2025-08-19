import subprocess
import asyncio
from typing import List, Dict
from ..utils.logging import get_logger

log = get_logger(__name__)

class PortForwardManager:
    """Manages iptables rules for port forwarding"""
    
    @staticmethod
    async def _run_command(cmd: List[str]) -> tuple[int, str, str]:
        """Run a system command asynchronously"""
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            return process.returncode, stdout.decode(), stderr.decode()
        except Exception as e:
            log.error(f"Command execution failed: {e}")
            return 1, "", str(e)

    @staticmethod
    async def check_iptables_available() -> bool:
        """Check if iptables is available on the system"""
        returncode, _, _ = await PortForwardManager._run_command(["which", "iptables"])
        return returncode == 0

    @staticmethod
    def _get_iptables_rule(source_port: int, target_host: str, target_port: int, protocol: str) -> List[str]:
        """Generate iptables rule for port forwarding"""
        return [
            "iptables", "-t", "nat", "-A", "PREROUTING",
            "-p", protocol, "--dport", str(source_port),
            "-j", "DNAT", "--to-destination", f"{target_host}:{target_port}"
        ]

    @staticmethod
    def _get_iptables_delete_rule(source_port: int, target_host: str, target_port: int, protocol: str) -> List[str]:
        """Generate iptables rule for deleting port forwarding"""
        return [
            "iptables", "-t", "nat", "-D", "PREROUTING",
            "-p", protocol, "--dport", str(source_port),
            "-j", "DNAT", "--to-destination", f"{target_host}:{target_port}"
        ]

    @staticmethod
    async def create_port_forward(source_port: int, target_host: str, target_port: int, protocol: str = "tcp") -> bool:
        """Create a port forwarding rule"""
        # Check if iptables is available
        if not await PortForwardManager.check_iptables_available():
            log.error("iptables is not available on this system")
            return False

        # Add the DNAT rule
        rule_cmd = PortForwardManager._get_iptables_rule(source_port, target_host, target_port, protocol)
        returncode, stdout, stderr = await PortForwardManager._run_command(rule_cmd)
        
        if returncode != 0:
            log.error(f"Failed to create port forward rule: {stderr}")
            return False

        # Enable IP forwarding if not already enabled
        forward_cmd = ["sysctl", "-w", "net.ipv4.ip_forward=1"]
        await PortForwardManager._run_command(forward_cmd)

        # Add FORWARD rule to accept the traffic
        forward_rule = [
            "iptables", "-A", "FORWARD",
            "-p", protocol, "--dport", str(target_port),
            "-d", target_host, "-j", "ACCEPT"
        ]
        await PortForwardManager._run_command(forward_rule)

        log.info(f"Created port forward: {source_port} -> {target_host}:{target_port} ({protocol})")
        return True

    @staticmethod
    async def delete_port_forward(source_port: int, target_host: str, target_port: int, protocol: str = "tcp") -> bool:
        """Delete a port forwarding rule"""
        if not await PortForwardManager.check_iptables_available():
            log.error("iptables is not available on this system")
            return False

        # Remove the DNAT rule
        delete_cmd = PortForwardManager._get_iptables_delete_rule(source_port, target_host, target_port, protocol)
        returncode, stdout, stderr = await PortForwardManager._run_command(delete_cmd)
        
        if returncode != 0:
            log.warning(f"Failed to delete port forward rule (may not exist): {stderr}")

        # Remove FORWARD rule
        delete_forward_rule = [
            "iptables", "-D", "FORWARD",
            "-p", protocol, "--dport", str(target_port),
            "-d", target_host, "-j", "ACCEPT"
        ]
        await PortForwardManager._run_command(delete_forward_rule)

        log.info(f"Deleted port forward: {source_port} -> {target_host}:{target_port} ({protocol})")
        return True

    @staticmethod
    async def list_port_forwards() -> List[Dict]:
        """List current iptables DNAT rules"""
        if not await PortForwardManager.check_iptables_available():
            return []

        cmd = ["iptables", "-t", "nat", "-L", "PREROUTING", "-n", "--line-numbers"]
        returncode, stdout, stderr = await PortForwardManager._run_command(cmd)
        
        if returncode != 0:
            log.error(f"Failed to list iptables rules: {stderr}")
            return []

        rules = []
        for line in stdout.split('\n')[2:]:  # Skip header lines
            if 'DNAT' in line and '--to-destination' in line:
                parts = line.split()
                if len(parts) >= 6:
                    try:
                        # Parse the rule (this is a simplified parser)
                        protocol = parts[2] if parts[2] != 'all' else 'tcp'
                        dport_idx = next(i for i, part in enumerate(parts) if 'dpt:' in part)
                        source_port = parts[dport_idx].split(':')[1]
                        
                        dest_idx = next(i for i, part in enumerate(parts) if '--to-destination' in part)
                        destination = parts[dest_idx + 1] if dest_idx + 1 < len(parts) else parts[dest_idx].split('--to-destination')[1]
                        
                        if ':' in destination:
                            target_host, target_port = destination.split(':')
                        else:
                            target_host, target_port = destination, source_port
                            
                        rules.append({
                            'source_port': int(source_port),
                            'target_host': target_host,
                            'target_port': int(target_port),
                            'protocol': protocol
                        })
                    except (ValueError, StopIteration, IndexError) as e:
                        log.warning(f"Failed to parse iptables rule: {line}, error: {e}")
                        continue

        return rules

    @staticmethod
    async def enable_port_forward(source_port: int, target_host: str, target_port: int, protocol: str = "tcp") -> bool:
        """Enable an existing port forward rule"""
        return await PortForwardManager.create_port_forward(source_port, target_host, target_port, protocol)

    @staticmethod
    async def disable_port_forward(source_port: int, target_host: str, target_port: int, protocol: str = "tcp") -> bool:
        """Disable an existing port forward rule"""
        return await PortForwardManager.delete_port_forward(source_port, target_host, target_port, protocol)
