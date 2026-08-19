import ipaddress
import socket
from dataclasses import dataclass


@dataclass(frozen=True)
class NetworkInfo:
    hostname: str
    local_hostname: str
    ip: str


def _hostname() -> str:
    hostname = socket.gethostname().strip().rstrip(".") or "codepad-mac"
    return hostname.removesuffix(".local")


def _is_usable_ipv4(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    return isinstance(address, ipaddress.IPv4Address) and not (
        address.is_loopback or address.is_link_local or address.is_unspecified
    )


def _local_ip(hostname: str) -> str:
    # Selecting a route does not send data. It gives the address macOS would use
    # for local-network traffic, while still working when DNS is unavailable.
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("192.0.2.1", 9))
        candidate = probe.getsockname()[0]
        if _is_usable_ipv4(candidate):
            return candidate
    except OSError:
        pass
    finally:
        probe.close()

    try:
        candidates = socket.getaddrinfo(hostname, None, socket.AF_INET)
    except socket.gaierror:
        candidates = []
    for candidate in candidates:
        address = candidate[4][0]
        if _is_usable_ipv4(address):
            return address
    return "127.0.0.1"


def get_network_info() -> NetworkInfo:
    hostname = _hostname()
    return NetworkInfo(
        hostname=hostname,
        local_hostname=f"{hostname}.local",
        ip=_local_ip(hostname),
    )
