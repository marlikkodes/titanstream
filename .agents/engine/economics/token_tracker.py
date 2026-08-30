"""
Agent System Observability & Telemetry Engine.
Tracks execution duration, token usage, tool invocation counts, repair attempts,
human escalations, and operational efficiency metrics.
"""

import os
import json
import time
from pathlib import Path
from typing import Dict, List, Any, Optional

class AgentObservability:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()
        self.state_dir = self.root_dir / ".agents" / "state"
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.metrics_file = self.state_dir / "metrics.json"
        self._ensure_file()

    def _ensure_file(self):
        if not self.metrics_file.exists():
            with open(self.metrics_file, "w", encoding="utf-8") as f:
                json.dump({
                    "total_missions": 0,
                    "total_tasks_executed": 0,
                    "total_tokens_consumed": 0,
                    "total_repairs": 0,
                    "total_escalations": 0,
                    "missions": []
                }, f, indent=2)

    def record_mission_metrics(
        self,
        mission_id: str,
        duration_seconds: float,
        tokens_consumed: int,
        tasks_count: int,
        repair_attempts: int,
        escalated: bool,
        tool_calls: int = 0
    ):
        with open(self.metrics_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        data["total_missions"] += 1
        data["total_tasks_executed"] += tasks_count
        data["total_tokens_consumed"] += tokens_consumed
        data["total_repairs"] += repair_attempts
        if escalated:
            data["total_escalations"] += 1

        data["missions"].append({
            "mission_id": mission_id,
            "timestamp": time.time(),
            "duration_seconds": round(duration_seconds, 2),
            "tokens_consumed": tokens_consumed,
            "tasks_count": tasks_count,
            "repair_attempts": repair_attempts,
            "escalated": escalated,
            "tool_calls": tool_calls
        })

        with open(self.metrics_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def get_summary(self) -> Dict[str, Any]:
        with open(self.metrics_file, "r", encoding="utf-8") as f:
            return json.load(f)