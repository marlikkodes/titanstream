"""
MCP Tool Governor & Circuit Breaker for Agent OS Phase II.
Monitors health, latency, reliability, and error rates of MCP and external tools,
tripping circuit breakers on degraded tools and failing over gracefully.
"""

import time
from typing import Dict, Any, List
from dataclasses import dataclass

@dataclass
class ToolHealthMetric:
    tool_name: str
    status: str       # "HEALTHY", "DEGRADED", "CIRCUIT_OPEN"
    failure_count: int
    success_count: int
    avg_latency_ms: float
    last_failure_time: float

class MCPGovernor:
    def __init__(self, failure_threshold: int = 3, reset_timeout_sec: float = 30.0):
        self.failure_threshold = failure_threshold
        self.reset_timeout_sec = reset_timeout_sec
        self.tools: Dict[str, ToolHealthMetric] = {}

    def get_tool_status(self, tool_name: str) -> str:
        """Returns health status of tool."""
        if tool_name not in self.tools:
            return "HEALTHY"
        metric = self.tools[tool_name]
        if metric.status == "CIRCUIT_OPEN":
            if time.time() - metric.last_failure_time > self.reset_timeout_sec:
                metric.status = "HALF_OPEN"
                return "HALF_OPEN"
            return "CIRCUIT_OPEN"
        return metric.status

    def record_call(self, tool_name: str, success: bool, latency_ms: float = 50.0):
        """Records outcome and updates circuit breaker state."""
        if tool_name not in self.tools:
            self.tools[tool_name] = ToolHealthMetric(
                tool_name=tool_name,
                status="HEALTHY",
                failure_count=0,
                success_count=0,
                avg_latency_ms=latency_ms,
                last_failure_time=0.0,
            )
        metric = self.tools[tool_name]
        if success:
            metric.success_count += 1
            metric.failure_count = max(0, metric.failure_count - 1)
            metric.status = "HEALTHY"
        else:
            metric.failure_count += 1
            metric.last_failure_time = time.time()
            if metric.failure_count >= self.failure_threshold:
                metric.status = "CIRCUIT_OPEN"

    def select_healthy_tool_or_fallback(self, preferred_tool: str, fallback_tool: str) -> str:
        """Selects preferred tool if circuit is closed, otherwise routes to fallback."""
        status = self.get_tool_status(preferred_tool)
        if status in ["HEALTHY", "HALF_OPEN"]:
            return preferred_tool
        return fallback_tool
