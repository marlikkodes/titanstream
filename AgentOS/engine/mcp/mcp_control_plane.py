"""
MCP Infrastructure Control Plane.
Tracks MCP server availability, tool latency, error rates, and enforces
circuit breakers to isolate failing external servers without halting Agent OS.
"""

import time
from enum import Enum
from typing import Dict, List, Any, Optional

class CircuitState(str, Enum):
    CLOSED = "CLOSED"       # Normal operation
    OPEN = "OPEN"           # Tripped, routing to fallback
    HALF_OPEN = "HALF_OPEN" # Testing recovery

class MCPControlPlane:
    def __init__(self, failure_threshold: int = 3, recovery_timeout: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.servers: Dict[str, Dict[str, Any]] = {}

    def register_server(self, server_name: str, tools: List[str], fallback_provider: Optional[str] = None):
        self.servers[server_name] = {
            "name": server_name,
            "tools": tools,
            "fallback_provider": fallback_provider or "local_deterministic",
            "state": CircuitState.CLOSED,
            "failure_count": 0,
            "last_failure_time": 0.0,
            "total_calls": 0,
            "total_latency": 0.0
        }

    def record_call(self, server_name: str, latency_seconds: float, success: bool):
        if server_name not in self.servers:
            self.register_server(server_name, [])

        srv = self.servers[server_name]
        srv["total_calls"] += 1
        srv["total_latency"] += latency_seconds

        if success:
            srv["failure_count"] = 0
            srv["state"] = CircuitState.CLOSED
        else:
            srv["failure_count"] += 1
            srv["last_failure_time"] = time.time()
            if srv["failure_count"] >= self.failure_threshold:
                srv["state"] = CircuitState.OPEN

    def get_routing_target(self, server_name: str) -> Dict[str, Any]:
        if server_name not in self.servers:
            return {"target": server_name, "use_fallback": False}

        srv = self.servers[server_name]
        if srv["state"] == CircuitState.OPEN:
            if time.time() - srv["last_failure_time"] > self.recovery_timeout:
                srv["state"] = CircuitState.HALF_OPEN
                return {"target": server_name, "use_fallback": False, "state": "HALF_OPEN_PROBE"}
            return {"target": srv["fallback_provider"], "use_fallback": True, "state": "CIRCUIT_OPEN"}

        return {"target": server_name, "use_fallback": False, "state": srv["state"].value}
